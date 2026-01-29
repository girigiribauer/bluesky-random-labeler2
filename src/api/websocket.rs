use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use tokio::sync::broadcast;
use atrium_api::com::atproto::label::defs::Label;
use atrium_api::com::atproto::label::subscribe_labels::{Labels, Message as SubscribeMessage};
use serde::{Deserialize, Serialize};
use crate::api::AppState;

#[derive(Serialize, Deserialize, Debug)]
struct StreamHeader {
    t: String,
    op: i64,
}

pub async fn subscribe_labels(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state.tx))
}

async fn handle_socket(mut socket: WebSocket, tx: broadcast::Sender<(i64, Vec<Label>)>) {
    let mut rx = tx.subscribe();

    while let Ok((seq, labels)) = rx.recv().await {
        // Construct Header
        let header = StreamHeader {
            t: "#labels".to_string(),
            op: 1, // Frame
        };

        // Construct Body
        let body = SubscribeMessage::Labels(Box::new(Labels {
            seq,
            labels,
        }));

        // Serialize
        if let (Ok(header_bytes), Ok(body_bytes)) = (
            serde_ipld_dagcbor::to_vec(&header),
            serde_ipld_dagcbor::to_vec(&body),
        ) {
            // Combine [Header][Body]
            let mut payload = header_bytes;
            payload.extend(body_bytes);

            // Send
            if socket.send(Message::Binary(payload)).await.is_err() {
                break;
            }
        } else {
            eprintln!("Failed to serialize label update");
        }
    }
}
