use anyhow::Result;
use atrium_api::agent::atp_agent::AtpAgent;
use atrium_xrpc_client::reqwest::ReqwestClient;
use crate::config::config;
use crate::db::DbPool;
use crate::domain::labeling::{assign_fortune, revoke_fortune, overwrite_fortune};
use crate::domain::fortune::Fortune;
use std::str::FromStr;
use crate::crypto::create_keypair;

use sqlx::Row;

use atrium_api::agent::atp_agent::store::MemorySessionStore;

use tokio::sync::broadcast;
use atrium_api::com::atproto::label::defs::Label;

use std::sync::Arc;
use tracing;

pub async fn run_optimized_batch(pool: DbPool, tx: broadcast::Sender<(i64, Vec<Label>)>) -> Result<()> {
    tracing::info!("Running optimized batch");
    let conf = config();
    let agent = AtpAgent::new(ReqwestClient::new("https://bsky.social"), MemorySessionStore::default());

    if let Some(pwd) = &conf.labeler_password {
        agent.login(conf.handle.as_deref().unwrap_or(&conf.labeler_did), pwd).await?;
    } else {
        tracing::info!("Skipping batch due to missing password.");
        return Ok(());
    }

    let keypair = Arc::new(create_keypair(&conf.signing_key_hex)?);

    let rows = sqlx::query("SELECT DISTINCT uri FROM labels WHERE is_deleted = 0").fetch_all(&pool).await?;
    let local_dids: Vec<String> = rows.iter().map(|r| r.get("uri")).collect();
    tracing::info!(count = local_dids.len(), "Found local users");

    let mut followers_map = std::collections::HashMap::new();
    let mut cursor: Option<String> = None;
    let actor = conf.handle.as_deref().unwrap_or(&conf.labeler_did);

    loop {
        let resp = agent.api.app.bsky.graph.get_followers(
            atrium_api::app::bsky::graph::get_followers::ParametersData {
                actor: if actor.starts_with("did:") {
                    atrium_api::types::string::AtIdentifier::Did(atrium_api::types::string::Did::new(actor.to_string()).expect("Invalid DID"))
                } else {
                    atrium_api::types::string::AtIdentifier::Handle(atrium_api::types::string::Handle::new(actor.to_string()).expect("Invalid Handle"))
                }.into(),
                cursor: cursor.clone(),
                limit: Some((100 as u8).try_into().unwrap()),
            }.into()
        ).await?;

        for f in &resp.followers {
            followers_map.insert(f.did.as_str().to_string(), f.handle.as_str().to_string());
        }

        if resp.cursor.is_none() {
            break;
        }
        cursor = resp.cursor.clone();
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    tracing::info!(count = followers_map.len(), "Fetched followers");

    for (did, handle) in &followers_map {
        if let Err(e) = assign_fortune(did, Some(handle), &pool, &keypair, &conf.labeler_did, &tx).await {
            tracing::error!(did, error = ?e, "Error assigning fortune");
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    for did in local_dids {
        if !followers_map.contains_key(&did) {
            if let Err(e) = revoke_fortune(&did, &pool, &keypair, &config().labeler_did, &tx).await {
                tracing::error!(did, error = ?e, "Error revoking fortune");
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
    }

    tracing::info!("Batch complete");
    Ok(())
}

pub async fn run_migration(pool: DbPool, tx: broadcast::Sender<(i64, Vec<Label>)>) -> Result<()> {
    tracing::info!("Starting migration batch (ID Rotation)");
    let conf = config();

    let keypair = Arc::new(create_keypair(&conf.signing_key_hex)?);

    // 1. Get ALL active users (Soft deleted are already gone/ignored)
    let rows = sqlx::query("SELECT DISTINCT uri FROM labels WHERE is_deleted = 0").fetch_all(&pool).await?;
    let active_dids: Vec<String> = rows.iter().map(|r| r.get("uri")).collect();
    tracing::info!(count = active_dids.len(), "Found active users for migration");

    let _agent = AtpAgent::new(ReqwestClient::new("https://bsky.social"), MemorySessionStore::default());
    if let Some(_pwd) = &conf.labeler_password {
         // Login optional for migration but good for consistent object creation if needed?
         // assign_fortune doesn't use agent.
    }

    for did in active_dids {
        // 2. Check for Fixed Status BEFORE deleting
        let current_labels = crate::db::get_labels(&pool, &did, None, None).await?;
        let fixed_entry = current_labels.iter().find(|l| l.is_fixed.unwrap_or(0) == 1 && l.neg == 0);

        let fixed_val = if let Some(f) = fixed_entry {
            // Map old string/new string to Enum (from_str handles both)
            Fortune::from_str(&f.val).ok()
        } else {
            None
        };

        // 3. Soft Delete EVERYTHING for this user (Clears old ID records active status)
        crate::db::delete_label(&pool, &did).await?;

        // 4. Re-apply
        if let Some(fortune_enum) = fixed_val {
             // Was fixed. Re-apply using NEW ID string (as_str() returns new)
             // overwrite_fortune sets is_fixed=true
             if let Err(e) = overwrite_fortune(&did, fortune_enum.as_str(), &pool, &keypair, &conf.labeler_did, &tx).await {
                 tracing::error!(did, error = ?e, "Error migrating fixed fortune");
             }
        } else {
             // Was random. Re-roll (or re-calc deterministic)
             if let Err(e) = assign_fortune(&did, None, &pool, &keypair, &conf.labeler_did, &tx).await {
                 tracing::error!(did, error = ?e, "Error migrating fortune");
             }
        }

        // Throttle to avoid flooding broadcast channel too fast?
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    tracing::info!("Migration complete");
    Ok(())
}
