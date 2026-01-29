use crate::db::{DbPool, upsert_label as db_upsert, delete_label as db_delete};
use crate::fortune::{get_daily_fortune, FORTUNES};
use crate::crypto::sign_label;
use atrium_crypto::keypair::Secp256k1Keypair;
use atrium_api::com::atproto::label::defs::{Label, LabelData};
use atrium_api::types::string::{Datetime, Did};
use chrono::{Utc, SubsecRound};
use anyhow::Result;
use tokio::sync::broadcast;

pub async fn process_user(
    did: &str,
    handle: Option<&str>,
    pool: &DbPool,
    keypair: &Secp256k1Keypair,
    labeler_did: &str,
    tx: &broadcast::Sender<(i64, Vec<Label>)>
) -> Result<()> {
    let fortune_val = get_daily_fortune(did);
    println!("Processing {} ({:?}), fortune: {}", did, handle, fortune_val);

    let negate_list: Vec<&str> = FORTUNES.iter()
        .map(|f| f.val)
        .filter(|&v| v != fortune_val)
        .collect();

    upsert_label(did, fortune_val, false, labeler_did, pool, keypair, tx).await?;

    for neg_val in negate_list {
        upsert_label(did, neg_val, true, labeler_did, pool, keypair, tx).await?;
    }

    Ok(())
}

pub async fn overwrite_fortune(
    did: &str,
    fortune_val: &str,
    pool: &DbPool,
    keypair: &Secp256k1Keypair,
    labeler_did: &str,
    tx: &broadcast::Sender<(i64, Vec<Label>)>
) -> Result<()> {
    let negate_list: Vec<&str> = FORTUNES.iter()
        .map(|f| f.val)
        .filter(|&v| v != fortune_val)
        .collect();

    upsert_label(did, fortune_val, false, labeler_did, pool, keypair, tx).await?;
    for neg_val in negate_list {
        upsert_label(did, neg_val, true, labeler_did, pool, keypair, tx).await?;
    }
    Ok(())
}

pub async fn negate_user(
    did: &str,
    pool: &DbPool,
    _keypair: &Secp256k1Keypair,
    _labeler_did: &str,
    _tx: &broadcast::Sender<(i64, Vec<Label>)>
) -> Result<()> {
    db_delete(pool, did).await?;
    Ok(())
}

async fn upsert_label(
    uri: &str,
    val: &str,
    neg: bool,
    src: &str,
    pool: &DbPool,
    keypair: &Secp256k1Keypair,
    tx: &broadcast::Sender<(i64, Vec<Label>)>
) -> Result<()> {
    let now = Utc::now().with_timezone(&chrono::FixedOffset::east_opt(0).unwrap()).round_subsecs(3);
    let cts = Datetime::new(now);

    let mut label_data = LabelData {
        cid: None,
        cts: cts.clone(),
        exp: None,
        neg: if neg { Some(true) } else { None },
        sig: None,
        src: Did::new(src.to_string()).expect("Invalid DID"), // Ensure config DID is valid
        uri: uri.to_string(),
        val: val.to_string(),
        ver: None,
    };

    sign_label(&mut label_data, keypair)?;

    let rowid = db_upsert(pool, uri, val, &cts.as_ref().to_rfc3339(), neg, src).await?;

    // Create Label struct for broadcast
    let label = Label {
        data: label_data.clone(),
        extra_data: ipld_core::ipld::Ipld::Null,
    };

    // Broadcast
    match tx.send((rowid, vec![label])) {
        Ok(count) => println!("Broadcaster: To {} listeners. Seq={}, Val={}", count, rowid, val),
        Err(_) => println!("Broadcaster: No listeners active. Seq={}, Val={}", rowid, val),
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_db, get_labels};

    #[tokio::test]
    async fn test_process_user_logic() -> Result<()> {
        let pool = init_db(":memory:").await?;
        use rand::rngs::OsRng;
        let mut rng = OsRng;
        let keypair = Secp256k1Keypair::create(&mut rng);
        let labeler_did = "did:plc:labeler";
        let target_did = "did:plc:target";
        let (tx, _rx) = broadcast::channel(100);

        process_user(target_did, None, &pool, &keypair, labeler_did, &tx).await?;

        let labels = get_labels(&pool, target_did, None, None).await?;
        assert!(!labels.is_empty(), "Labels should be created");

        let positives: Vec<_> = labels.iter().filter(|l| l.neg == 0).collect();
        let negatives: Vec<_> = labels.iter().filter(|l| l.neg == 1).collect();

        assert_eq!(positives.len(), 1, "Should have exactly 1 positive label");
        assert_eq!(negatives.len(), 6, "Should have 6 negative labels");
        assert_eq!(labels.len(), 7, "Total labels should be 7");

        println!("Granted fortune: {}", positives[0].val);

        Ok(())
    }
}
