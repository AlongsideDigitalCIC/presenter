use tauri::Manager;
use std::collections::HashMap;
use std::net::SocketAddr;
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

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DetectedChurchApp {
    id: String,
    name: String,
    description: String,
    display_path: String,
    item_count: usize,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectedAppFile {
    name: String,
    path: String,
    base64: String,
}

fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;

        out.push(TABLE[((n >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((n >> 6) & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(n & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn collect_matching_files(
    dir: &std::path::Path,
    allowed_exts: Option<&[&str]>,
    allow_extensionless: bool,
    max_depth: usize,
    out: &mut Vec<std::path::PathBuf>,
) {
    if max_depth == 0 || out.len() >= 5000 || !dir.is_dir() {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if out.len() >= 5000 {
            break;
        }
        let path = entry.path();
        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if file_name.starts_with('.')
            || file_name.eq_ignore_ascii_case("desktop.ini")
            || file_name.eq_ignore_ascii_case("thumbs.db")
            || file_name.eq_ignore_ascii_case("globals")
        {
            continue;
        }
        if path.is_dir() {
            collect_matching_files(&path, allowed_exts, allow_extensionless, max_depth - 1, out);
        } else if path.is_file() {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_ascii_lowercase());
            match (ext.as_deref(), allowed_exts) {
                (Some(e), Some(exts)) => {
                    if exts.iter().any(|allowed| *allowed == e) {
                        out.push(path);
                    }
                }
                (None, _) if allow_extensionless => {
                    out.push(path);
                }
                _ => {}
            }
        }
    }
}

fn find_easyworship_data_dir(base: &std::path::Path, max_depth: usize) -> Option<std::path::PathBuf> {
    if max_depth == 0 || !base.is_dir() {
        return None;
    }
    let words_candidate = base.join("SongWords.db");
    if words_candidate.is_file() {
        return Some(base.to_path_buf());
    }
    let entries = std::fs::read_dir(base).ok()?;
    let mut best: Option<(std::time::SystemTime, std::path::PathBuf)> = None;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            if let Some(found) = find_easyworship_data_dir(&p, max_depth - 1) {
                let mtime = std::fs::metadata(found.join("SongWords.db"))
                    .and_then(|m| m.modified())
                    .unwrap_or(std::time::UNIX_EPOCH);
                if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
                    best = Some((mtime, found));
                }
            }
        }
    }
    best.map(|(_, p)| p)
}

fn resolve_detected_sources(app: &tauri::AppHandle) -> Vec<(DetectedChurchApp, Vec<std::path::PathBuf>)> {
    let mut results = Vec::new();
    let doc_dir = app.path().document_dir().ok();
    let data_dir = app.path().data_dir().ok();
    let public_docs = std::path::PathBuf::from("C:\\Users\\Public\\Documents");

    // 1. ProPresenter 7
    if let Some(ref docs) = doc_dir {
        let pp7_dir = docs.join("ProPresenter").join("Libraries");
        let mut files = Vec::new();
        collect_matching_files(&pp7_dir, Some(&["pro"]), false, 4, &mut files);
        if !files.is_empty() {
            results.push((
                DetectedChurchApp {
                    id: "propresenter7".to_string(),
                    name: "ProPresenter 7".to_string(),
                    description: format!("{} presentation files found in Libraries", files.len()),
                    display_path: pp7_dir.to_string_lossy().into_owned(),
                    item_count: files.len(),
                },
                files,
            ));
        }
    }

    // 2. ProPresenter 6
    {
        let mut pp6_candidates = Vec::new();
        if let Some(ref data) = data_dir {
            pp6_candidates.push(data.join("RenewedVision").join("ProPresenter6").join("Library"));
            pp6_candidates.push(data.join("RenewedVision").join("ProPresenter6"));
        }
        if let Some(ref docs) = doc_dir {
            pp6_candidates.push(docs.join("ProPresenter6"));
        }
        for cand in pp6_candidates {
            let mut files = Vec::new();
            collect_matching_files(&cand, Some(&["pro6", "pro5", "pro4"]), false, 3, &mut files);
            if !files.is_empty() {
                results.push((
                    DetectedChurchApp {
                        id: "propresenter6".to_string(),
                        name: "ProPresenter 6".to_string(),
                        description: format!("{} song files found in Library", files.len()),
                        display_path: cand.to_string_lossy().into_owned(),
                        item_count: files.len(),
                    },
                    files,
                ));
                break;
            }
        }
    }

    // 3. FreeShow
    if let Some(ref docs) = doc_dir {
        let fs_dir = docs.join("FreeShow").join("Shows");
        let mut files = Vec::new();
        collect_matching_files(&fs_dir, Some(&["show", "json"]), false, 3, &mut files);
        if !files.is_empty() {
            results.push((
                DetectedChurchApp {
                    id: "freeshow".to_string(),
                    name: "FreeShow".to_string(),
                    description: format!("{} show files found in Shows folder", files.len()),
                    display_path: fs_dir.to_string_lossy().into_owned(),
                    item_count: files.len(),
                },
                files,
            ));
        }
    }

    // 4. OpenLP
    if let Some(ref data) = data_dir {
        let olp_candidates = [
            data.join("openlp").join("data").join("songs").join("songs.sqlite"),
            data.join("openlp").join("Data").join("songs").join("songs.sqlite"),
        ];
        for db_path in olp_candidates {
            if db_path.is_file() {
                results.push((
                    DetectedChurchApp {
                        id: "openlp".to_string(),
                        name: "OpenLP".to_string(),
                        description: "Local OpenLP songs.sqlite database".to_string(),
                        display_path: db_path.to_string_lossy().into_owned(),
                        item_count: 1,
                    },
                    vec![db_path],
                ));
                break;
            }
        }
    }

    // 5. EasyWorship 6 / 7
    {
        let mut ew_roots = vec![public_docs.join("Softouch").join("Easyworship")];
        if let Some(ref docs) = doc_dir {
            ew_roots.push(docs.join("Softouch").join("Easyworship"));
        }
        for root in ew_roots {
            if let Some(data_folder) = find_easyworship_data_dir(&root, 6) {
                let mut db_files = Vec::new();
                let songs_db = data_folder.join("Songs.db");
                let words_db = data_folder.join("SongWords.db");
                if songs_db.is_file() {
                    db_files.push(songs_db);
                }
                if words_db.is_file() {
                    db_files.push(words_db);
                }
                if !db_files.is_empty() {
                    results.push((
                        DetectedChurchApp {
                            id: "easyworship".to_string(),
                            name: "EasyWorship".to_string(),
                            description: "Local EasyWorship song database".to_string(),
                            display_path: data_folder.to_string_lossy().into_owned(),
                            item_count: db_files.len(),
                        },
                        db_files,
                    ));
                    break;
                }
            }
        }
    }

    // 6. OpenSong
    if let Some(ref docs) = doc_dir {
        let os_dir = docs.join("OpenSong").join("Songs");
        let mut files = Vec::new();
        collect_matching_files(&os_dir, Some(&["xml"]), true, 3, &mut files);
        if !files.is_empty() {
            results.push((
                DetectedChurchApp {
                    id: "opensong".to_string(),
                    name: "OpenSong".to_string(),
                    description: format!("{} songs found in OpenSong/Songs", files.len()),
                    display_path: os_dir.to_string_lossy().into_owned(),
                    item_count: files.len(),
                },
                files,
            ));
        }
    }

    // 7. VideoPsalm
    {
        let mut vp_roots = vec![public_docs.join("VideoPsalm").join("SongBooks")];
        if let Some(ref docs) = doc_dir {
            vp_roots.push(docs.join("VideoPsalm").join("SongBooks"));
        }
        for root in vp_roots {
            let mut files = Vec::new();
            collect_matching_files(&root, Some(&["vpc"]), false, 3, &mut files);
            if !files.is_empty() {
                results.push((
                    DetectedChurchApp {
                        id: "videopsalm".to_string(),
                        name: "VideoPsalm".to_string(),
                        description: format!("{} songbook(s) found", files.len()),
                        display_path: root.to_string_lossy().into_owned(),
                        item_count: files.len(),
                    },
                    files,
                ));
                break;
            }
        }
    }

    // 8. SongBeamer
    if let Some(ref docs) = doc_dir {
        let sb_dir = docs.join("SongBeamer").join("Songs");
        let mut files = Vec::new();
        collect_matching_files(&sb_dir, Some(&["sng"]), false, 3, &mut files);
        if !files.is_empty() {
            results.push((
                DetectedChurchApp {
                    id: "songbeamer".to_string(),
                    name: "SongBeamer".to_string(),
                    description: format!("{} .sng songs found", files.len()),
                    display_path: sb_dir.to_string_lossy().into_owned(),
                    item_count: files.len(),
                },
                files,
            ));
        }
    }

    results
}

#[tauri::command]
fn detect_installed_church_apps(app: tauri::AppHandle) -> Result<Vec<DetectedChurchApp>, String> {
    let sources = resolve_detected_sources(&app);
    Ok(sources.into_iter().map(|(meta, _)| meta).collect())
}

#[tauri::command]
async fn read_detected_church_app_files(
    app: tauri::AppHandle,
    source_id: String,
) -> Result<Vec<DetectedAppFile>, String> {
    let sources = resolve_detected_sources(&app);
    let (_, paths) = sources
        .into_iter()
        .find(|(meta, _)| meta.id == source_id)
        .ok_or_else(|| format!("Detected source '{}' is no longer available", source_id))?;

    let mut out = Vec::with_capacity(paths.len());
    for p in paths {
        // Skip oversized files (> 64 MB) to protect memory
        if let Ok(meta) = std::fs::metadata(&p) {
            if meta.len() > 64 * 1024 * 1024 {
                continue;
            }
        }
        if let Ok(bytes) = std::fs::read(&p) {
            let name = p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Song")
                .to_string();
            out.push(DetectedAppFile {
                name,
                path: p.to_string_lossy().into_owned(),
                base64: encode_base64(&bytes),
            });
        }
    }
    Ok(out)
}


async fn client_connection(ws: WebSocket, clients: Clients, addr: Option<SocketAddr>) {
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

    let is_socket_loopback = addr.map(|a| a.ip().is_loopback()).unwrap_or(false);

    while let Some(result) = client_ws_rcv.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("[WS] Client {} connection ended: {:?}", my_id, e);
                break;
            }
        };

        let mut is_current_master = {
            let map = clients.lock().unwrap();
            map.get(&my_id).map(|info| info.is_master).unwrap_or(false)
        };

        // If connection is directly from loopback (127.0.0.1) on the host machine, allow it to act as master
        if !is_current_master && is_socket_loopback {
            let mut map = clients.lock().unwrap();
            if let Some(info) = map.get_mut(&my_id) {
                info.is_master = true;
                is_current_master = true;
                eprintln!("[WS] Localhost connection authenticated as master: client ID {}", my_id);
            }
        }

        if msg.is_binary() {
            // Only the master Presenter instance is allowed to broadcast binary assets (media sync)
            if is_current_master {
                let map = clients.lock().unwrap();
                let client_count = map.len().saturating_sub(1);
                eprintln!("[WS] Master broadcasting binary frame ({} bytes) to {} connected follower(s)", msg.as_bytes().len(), client_count);
                for (&id, info) in map.iter() {
                    if id != my_id {
                        let _ = info.sender.send(msg.clone());
                    }
                }
            } else {
                eprintln!("[WS] Ignored binary frame from non-master connection ID: {}", my_id);
            }
            continue;
        }

        if let Ok(text) = msg.to_str() {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
                let msg_type = val.get("type").and_then(|v| v.as_str()).unwrap_or("");

                // 1. Handle Master registration handshake
                if msg_type == "master_register" {
                    let token = val.get("token").and_then(|v| v.as_str()).unwrap_or("");
                    let is_local_claim = val.get("local").and_then(|v| v.as_bool()).unwrap_or(false);
                    let is_valid = (token == get_or_create_master_token()) || (is_local_claim && is_socket_loopback) || is_socket_loopback;

                    if is_valid {
                        let mut map = clients.lock().unwrap();
                        if let Some(info) = map.get_mut(&my_id) {
                            info.is_master = true;
                            eprintln!("[WS] Master successfully authenticated on client ID {}", my_id);
                            let ack = serde_json::json!({
                                "type": "master_registered",
                                "success": true
                            });
                            let _ = info.sender.send(Message::text(ack.to_string()));
                        }
                    } else {
                        eprintln!("[WS] Master registration rejected for client ID {}: unauthorized", my_id);
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
            close_projector_window,
            detect_installed_church_apps,
            read_detected_church_app_files
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
                .and(warp::addr::remote())
                .and(clients_filter)
                .map(|ws: warp::ws::Ws, addr: Option<SocketAddr>, clients| {
                    ws.max_message_size(256 * 1024 * 1024)
                      .max_frame_size(256 * 1024 * 1024)
                      .on_upgrade(move |socket| client_connection(socket, clients, addr))
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
