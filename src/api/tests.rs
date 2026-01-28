#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        Router,
    };
    use tower::util::ServiceExt;
    use serde_json::Value;
    use atrium_api::com::atproto::label::query_labels::Output;
    use crate::api::router;
    use crate::api::label::AppState;
    use crate::db::init_db;
    use crate::db::upsert_label as db_upsert;
    use atrium_crypto::keypair::Secp256k1Keypair;
    use std::sync::Arc;
    use rand::rngs::OsRng;

    async fn setup_app() -> Router {
        let pool = init_db(":memory:").await.unwrap();
        let mut rng = OsRng;
        let keypair = Arc::new(Secp256k1Keypair::create(&mut rng));
        let state = AppState { pool: pool.clone(), keypair: keypair.clone() };

        // Pre-insert some data
        let now_str = chrono::Utc::now().to_rfc3339();
        db_upsert(&pool, "did:plc:test", "fortune_val", &now_str, false, "did:plc:labeler").await.unwrap();

        router(state)
    }

    #[tokio::test]
    async fn test_query_labels() {
        let app = setup_app().await;

        let req = Request::builder()
            .uri("/xrpc/com.atproto.label.queryLabels?uriPatterns[]=did:plc:test")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_json: Output = serde_json::from_slice(&body).unwrap();

        assert_eq!(body_json.labels.len(), 1);
        assert_eq!(body_json.labels[0].uri, "did:plc:test");
        assert_eq!(body_json.labels[0].val, "fortune_val");
    }

    #[tokio::test]
    async fn test_query_labels_empty() {
        let app = setup_app().await;

        let req = Request::builder()
            .uri("/xrpc/com.atproto.label.queryLabels?uriPatterns[]=did:plc:unknown")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_json: Output = serde_json::from_slice(&body).unwrap();

        assert_eq!(body_json.labels.len(), 0);
    }
}
