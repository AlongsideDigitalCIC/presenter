use tauri::Manager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use tokio::sync::mpsc;
use warp::ws::{Message, WebSocket};
use warp::Filter;
use futures::{StreamExt, SinkExt};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri_plugin_fs::FsExt;

#[derive(Clone)]
struct ClientInfo {
    sender: mpsc::UnboundedSender<Message>,
    is_master: bool,
    client_id: Option<String>,
}

type Clients = Arc<Mutex<HashMap<usize, ClientInfo>>>;
static NEXT_USER_ID: AtomicUsize = AtomicUsize::new(1);
static MASTER_TOKEN: OnceLock<String> = OnceLock::new();

fn get_or_create_master_token() -> &'static str {
    MASTER_TOKEN.get_or_init(|| {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        let pid = std::process::id();
        format!("{:016x}{:08x}{:08x}", now, pid, NEXT_USER_ID.fetch_add(1, Ordering::Relaxed))
    })
}

#[tauri::command]
fn get_master_token() -> String {
    get_or_create_master_token().to_string()
}

#[tauri::command]
fn allow_library_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    app.fs_scope().allow_directory(p, true).map_err(|e| e.to_string())?;
    Ok(())
}

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

#[tauri::command]
async fn open_projector_window(
    app: tauri::AppHandle,
    monitor_name: Option<String>,
    monitor_x: Option<i32>,
    monitor_y: Option<i32>,
    windowed: Option<bool>,
) -> Result<(), String> {
    let is_windowed = windowed.unwrap_or(false);

    if let Some(existing) = app.get_webview_window("projector") {
        let _ = existing.set_fullscreen(false);
        let _ = existing.destroy();
        tokio::time::sleep(std::time::Duration::from_millis(40)).await;
    }

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let main_win = app.get_webview_window("main");
    let main_mon = main_win
        .as_ref()
        .and_then(|w| w.current_monitor().ok().flatten());

    let target_monitor = if is_windowed {
        None
    } else if monitor_name.is_some() || (monitor_x.is_some() && monitor_y.is_some()) {
        monitors
            .iter()
            .find(|m| {
                let name_matches = match (&monitor_name, m.name()) {
                    (Some(req), Some(actual)) => req == actual,
                    _ => false,
                };
                let pos_matches = match (monitor_x, monitor_y) {
                    (Some(rx), Some(ry)) => m.position().x == rx && m.position().y == ry,
                    _ => false,
                };
                name_matches && pos_matches
            })
            .or_else(|| {
                monitors.iter().find(|m| match (monitor_x, monitor_y) {
                    (Some(rx), Some(ry)) => m.position().x == rx && m.position().y == ry,
                    _ => false,
                })
            })
            .or_else(|| {
                monitors.iter().find(|m| match (&monitor_name, m.name()) {
                    (Some(req), Some(actual)) => req == actual,
                    _ => false,
                })
            })
            .cloned()
            .or_else(|| monitors.first().cloned())
    } else if monitors.len() > 1 {
        monitors
            .iter()
            .find(|m| {
                if let Some(ref mm) = main_mon {
                    m.position().x != mm.position().x || m.position().y != mm.position().y
                } else {
                    m.position().x != 0 || m.position().y != 0
                }
            })
            .cloned()
            .or_else(|| monitors.get(1).cloned())
            .or_else(|| monitors.first().cloned())
    } else {
        monitors.first().cloned()
    };

    let same_as_main = match (&target_monitor, &main_mon) {
        (Some(tm), Some(mm)) => {
            tm.position().x == mm.position().x && tm.position().y == mm.position().y
        }
        _ => true,
    };

    let mut builder = tauri::WebviewWindowBuilder::new(
        &app,
        "projector",
        tauri::WebviewUrl::App("/?projector=true".into()),
    )
    .title("Presenter - Projector")
    .resizable(true);

    if is_windowed {
        builder = builder
            .inner_size(1280.0, 720.0)
            .decorations(true)
            .fullscreen(false)
            .visible(true);
    } else {
        builder = builder
            .decorations(false)
            .fullscreen(true)
            .visible(false);
    }

    let proj = builder.build().map_err(|e| e.to_string())?;

    if !is_windowed {
        if let Some(ref mon) = target_monitor {
            let pos = mon.position();
            let size = mon.size();
            let _ = proj.set_position(tauri::Position::Physical(*pos));
            let _ = proj.set_size(tauri::Size::Physical(*size));
        }
        let _ = proj.set_decorations(false);
        let _ = proj.set_fullscreen(true);
        let _ = proj.show();

        if !same_as_main {
            if let Some(mw) = main_win {
                let _ = mw.set_focus();
            }
        } else {
            let _ = proj.set_focus();
        }
    } else {
        let _ = proj.show();
        let _ = proj.set_focus();
    }

    Ok(())
}

#[tauri::command]
async fn close_projector_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("projector") {
        let _ = existing.set_fullscreen(false);
        let _ = existing.destroy();
    }
    Ok(())
}


async fn client_connection(ws: WebSocket, clients: Clients) {
    let (mut client_ws_sender, mut client_ws_rcv) = ws.split();
    let (client_sender, mut client_rcv) = mpsc::unbounded_channel();

    let my_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);
    clients.lock().unwrap().insert(my_id, ClientInfo {
        sender: client_sender,
        is_master: false,
        client_id: None,
    });

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

        let is_current_master = {
            let map = clients.lock().unwrap();
            map.get(&my_id).map(|info| info.is_master).unwrap_or(false)
        };

        if msg.is_binary() {
            // Only the master Presenter instance is allowed to broadcast binary assets (media sync)
            if is_current_master {
                let map = clients.lock().unwrap();
                for (&id, info) in map.iter() {
                    if id != my_id {
                        let _ = info.sender.send(msg.clone());
                    }
                }
            }
            continue;
        }

        if let Ok(text) = msg.to_str() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
                let msg_type = val.get("type").and_then(|v| v.as_str()).unwrap_or("");

                // 1. Handle Master registration handshake
                if msg_type == "master_register" {
                    let token = val.get("token").and_then(|v| v.as_str()).unwrap_or("");
                    if token == get_or_create_master_token() {
                        let mut map = clients.lock().unwrap();
                        if let Some(info) = map.get_mut(&my_id) {
                            info.is_master = true;
                            let ack = serde_json::json!({
                                "type": "master_registered",
                                "success": true
                            });
                            let _ = info.sender.send(Message::text(ack.to_string()));
                        }
                    }
                    continue;
                }

                // 2. Track client ID if present
                if let Some(cid) = val.get("clientId").and_then(|v| v.as_str()) {
                    let mut map = clients.lock().unwrap();
                    if let Some(info) = map.get_mut(&my_id) {
                        info.client_id = Some(cid.to_string());
                    }
                }

                // 3. Routing from Master
                if is_current_master {
                    let target_client_id = val.get("targetClientId").and_then(|v| v.as_str());
                    let map = clients.lock().unwrap();

                    if let Some(target) = target_client_id {
                        // Unicast: deliver directly only to the targeted client socket
                        for (&id, info) in map.iter() {
                            if id != my_id && info.client_id.as_deref() == Some(target) {
                                let _ = info.sender.send(msg.clone());
                            }
                        }
                    } else {
                        // Broadcast to all non-master clients
                        for (&id, info) in map.iter() {
                            if id != my_id {
                                let _ = info.sender.send(msg.clone());
                            }
                        }
                    }
                    continue;
                }

                // 4. Routing from Non-Master (Remote Viewer / Remote Control)
                // Restrict allowed message types to prevent presentation takeover / spoofing
                match msg_type {
                    "request_state" | "auth_verify" | "remote_command" | "client_register" => {
                        // Route only to master(s), do not broadcast to other peers
                        let map = clients.lock().unwrap();
                        for (&id, info) in map.iter() {
                            if id != my_id && info.is_master {
                                let _ = info.sender.send(msg.clone());
                            }
                        }
                    }
                    _ => {
                        // Drop unauthorized state / sync messages from unauthenticated sockets
                        eprintln!("[Security] Blocked unauthorized message type '{}' from non-master client", msg_type);
                    }
                }
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
        .invoke_handler(tauri::generate_handler![
            get_local_ip,
            get_hostname,
            get_master_token,
            allow_library_folder,
            open_projector_window,
            close_projector_window
        ])
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
                    ws.max_message_size(256 * 1024 * 1024)
                      .max_frame_size(256 * 1024 * 1024)
                      .on_upgrade(move |socket| client_connection(socket, clients))
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
