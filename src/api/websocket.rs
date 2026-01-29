use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::Response,
};
use atrium_api::com::atproto::label::subscribe_labels::{Labels, LabelsData, Message as SubscribeMessage};
use atrium_api::com::atproto::label::defs::Label;
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use crate::api::AppState;
use ipld_core::ipld::Ipld;

#[derive(Serialize, Deserialize, Debug)]
struct StreamHeader {
    t: String,
    op: i64,
}

pub async fn subscribe_labels(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    println!("WS: subscribeLabels request received");
    ws.on_upgrade(move |socket| handle_socket(socket, state.tx))
}

async fn handle_socket(mut socket: WebSocket, tx: broadcast::Sender<(i64, Vec<Label>)>) {
    println!("WS: Connection established");
    let mut rx = tx.subscribe();

    while let Ok((seq, labels)) = rx.recv().await {
        println!("WS: Received broadcast seq={}, labels_count={}", seq, labels.len());
        // Construct Header
        let header = StreamHeader {
            t: "#labels".to_string(),
            op: 1, // Frame
        };

        // Construct Body
        let body = SubscribeMessage::Labels(Box::new(Labels {
            data: LabelsData {
                seq,
                labels,
            },
            extra_data: Ipld::Null,
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
            if let Err(e) = socket.send(Message::Binary(payload)).await {
                println!("WS: Failed to send message: {}", e);
                break;
            } else {
                println!("WS: Sent message to client");
            }
        } else {
            eprintln!("Failed to serialize label update");
        }
    }
    println!("WS: Connection closed");
}
