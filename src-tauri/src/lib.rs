use tauri::Manager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use warp::ws::{Message, WebSocket};
use warp::Filter;
use futures::{StreamExt, SinkExt};
use std::sync::atomic::{AtomicUsize, Ordering};

type Clients = Arc<Mutex<HashMap<usize, mpsc::UnboundedSender<Message>>>>;
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);

#[tauri::command]
fn get_local_ip() -> String {
    use std::net::UdpSocket;
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if let Ok(_) = socket.connect("8.8.8.8:80") {
            if let Ok(local_addr) = socket.local_addr() {
                return local_addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}

#[tauri::command]
fn get_hostname() -> String {
    hostname::get().map(|h| h.to_string_lossy().into_owned()).unwrap_or_else(|_| "presenter.local".to_string())
}


async fn client_connection(ws: WebSocket, clients: Clients) {
    let (mut client_ws_sender, mut client_ws_rcv) = ws.split();
    let (client_sender, mut client_rcv) = mpsc::unbounded_channel();

    let my_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);
    clients.lock().unwrap().insert(my_id, client_sender);

    tokio::task::spawn(async move {
        while let Some(message) = client_rcv.recv().await {
            let _ = client_ws_sender.send(message).await;
        }
    });

    while let Some(result) = client_ws_rcv.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(_) => break,
        };

        for (&id, tx) in clients.lock().unwrap().iter() {
            if my_id != id {
                let _ = tx.send(msg.clone());
            }
        }
    }

    clients.lock().unwrap().remove(&my_id);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    std::process::exit(0);
                }
            }
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![get_local_ip, get_hostname])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            let mut resource_dir = app.path().resolve("../dist", tauri::path::BaseDirectory::Resource).unwrap_or_else(|_| std::env::current_dir().unwrap().join("dist"));
            
            if !resource_dir.exists() {
                if let Ok(exe_path) = std::env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        let candidates = vec![
                            exe_dir.join("dist"),
                            exe_dir.join("_up_").join("dist"),
                            exe_dir.join("resources").join("dist"),
                            exe_dir.join("resources").join("_up_").join("dist"),
                            std::env::current_dir().unwrap_or_default().join("dist"),
                        ];
                        for c in candidates {
                            if c.exists() && c.join("index.html").exists() {
                                resource_dir = c;
                                break;
                            }
                        }
                    }
                }
            }
            
            let cors = warp::cors().allow_any_origin().allow_methods(vec!["GET", "POST", "OPTIONS"]).allow_headers(vec!["Content-Type"]);
            
            // Serve static files, and fallback to index.html for SPA routing
            let static_route = warp::fs::dir(resource_dir.clone())
                .or(warp::fs::file(resource_dir.join("index.html")))
                .with(cors);
            
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async move {
                    println!("Static HTTP server running on http://0.0.0.0:5178/");
                    warp::serve(static_route).run(([0, 0, 0, 0], 5178)).await;
                });
            });

            let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
            let clients_filter = warp::any().map(move || clients.clone());
            
            let ws_route = warp::ws()
                .and(clients_filter)
                .map(|ws: warp::ws::Ws, clients| {
                    ws.on_upgrade(move |socket| client_connection(socket, clients))
                });
            
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async move {
                    println!("Presenter WebSocket server running on ws://0.0.0.0:5179/");
                    warp::serve(ws_route).run(([0, 0, 0, 0], 5179)).await;
                });
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
