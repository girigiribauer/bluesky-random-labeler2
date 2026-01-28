use axum::{Json, extract::State};
use atrium_api::com::atproto::moderation::create_report::{Input, Output, OutputSubjectRefs, OutputData};
use chrono::FixedOffset;
use crate::api::label::AppState;
use crate::config::config;
use crate::fortune::FORTUNES;
use crate::labeling::overwrite_fortune;
use atrium_api::types::string::{Did, Datetime};

pub async fn create_report(
    State(state): State<AppState>,
    Json(input): Json<Input>,
) -> Json<Output> {
use atrium_api::com::atproto::moderation::create_report::InputSubjectRefs;
use atrium_api::types::Union;

    if let Some(reason) = &input.reason {
        let mut best_match: Option<&str> = None;
        let mut best_len = 0;

        for f in FORTUNES {
            if reason.contains(f.val) {
                if f.val.len() > best_len {
                    best_match = Some(f.val);
                    best_len = f.val.len();
                }
            }
            if reason.contains(f.label) {
                if f.label.len() > best_len {
                    best_match = Some(f.val);
                    best_len = f.label.len();
                }
            }
        }

        if let Some(val) = best_match {
            let did = match &input.subject {
                Union::Refs(InputSubjectRefs::ComAtprotoAdminDefsRepoRef(r)) => Some(r.did.as_str()),
                Union::Refs(InputSubjectRefs::ComAtprotoRepoStrongRefMain(r)) => match atrium_api::types::string::Did::new(r.uri.clone()) {
                     Ok(_) => Some(r.uri.as_str()),
                     _ => if r.uri.starts_with("at://") {
                         r.uri.split('/').nth(2)
                     } else {
                         None
                     }
                },
                _ => None,
            };

            if let Some(did_str) = did {
                println!("Gimmick Triggered! Forcing {} for: {}", val, did_str);
                if let Err(e) = overwrite_fortune(
                    did_str,
                    val,
                    &state.pool,
                    &state.keypair,
                    &config().labeler_did
                ).await {
                    eprintln!("Failed to overwrite fortune: {}", e);
                } else {
                    println!("Fortune overwritten successfully.");
                }
            } else {
                println!("Gimmick: Failed to extract DID from subject.");
            }
        } else {
            println!("Gimmick: No matching fortune keyword found in reason: {}", reason);
        }
    } else {
        println!("Gimmick: No reason provided in report.");
    }

    let subject = match &input.subject {
        Union::Refs(InputSubjectRefs::ComAtprotoAdminDefsRepoRef(r)) => OutputSubjectRefs::ComAtprotoAdminDefsRepoRef(r.clone()),
        Union::Refs(InputSubjectRefs::ComAtprotoRepoStrongRefMain(r)) => OutputSubjectRefs::ComAtprotoRepoStrongRefMain(r.clone()),
        _ => panic!("Unknown subject type"),
    };

    let now = chrono::Utc::now().with_timezone(&FixedOffset::east_opt(0).unwrap());
    Json(OutputData {
        created_at: Datetime::new(now),
        id: 12345, // Dummy ID
        reason: input.reason.clone(),
        reason_type: input.reason_type.clone(),
        reported_by: Did::new("did:plc:unknown".to_string()).unwrap(),
        subject: Union::Refs(subject),
    }.into())
}
