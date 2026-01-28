mod api;
mod config;
mod db;
mod fortune;
mod labeling;
mod crypto;
mod poller;
mod scheduler;

use crate::config::config;
use crate::db::init_db;
use crate::api::router;
use crate::api::label::AppState;
use crate::crypto::create_keypair;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio_cron_scheduler::{Job, JobScheduler};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let conf = config();
    println!("Starting Bluesky Random Labeler on port {}", conf.port);

    let pool = init_db(&conf.db_path).await?;

    let keypair = Arc::new(create_keypair(&conf.signing_key_hex)?);

    let pool_clone = pool.clone();
    let keypair_clone = keypair.clone();
    tokio::spawn(async move {
        if let Err(e) = poller::start_polling(pool_clone, keypair_clone).await {
            eprintln!("Poller failed: {}", e);
        }
    });

    let sched_pool = pool.clone();
    let sched = JobScheduler::new().await?;

    sched.add(
        Job::new_async("0 0 15 * * *", move |_uuid, _l| {
            let p = sched_pool.clone();
            Box::pin(async move {
                if let Err(e) = scheduler::run_optimized_batch(p).await {
                    eprintln!("Scheduler batch failed: {}", e);
                }
            })
        })?
    ).await?;
    sched.start().await?;

    let state = AppState {
        pool,
        keypair,
    };

    let app = router(state);
    let addr = format!("0.0.0.0:{}", conf.port);
    let listener = TcpListener::bind(&addr).await?;
    println!("Server bound to {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
