use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, WebviewWindowBuilder, WebviewUrl, Emitter};

struct AppState {
    current_state: Mutex<serde_json::Value>,
    pending_open_files: Mutex<Vec<String>>,
    frontend_ready: Mutex<bool>,
}

fn is_supported_glide_path(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(),
        Some("glide") | Some("json")
    )
}

fn handle_external_file_path(app: &AppHandle, raw_path: &str) {
    let trimmed = raw_path.trim().trim_matches('"').trim();
    if trimmed.is_empty() {
        return;
    }
    let path = Path::new(trimmed);
    if !is_supported_glide_path(path) {
        return;
    }
    let normalized = path.to_string_lossy().to_string();
    let is_ready = {
        let state = app.state::<AppState>();
        let ready = *state.frontend_ready.lock().unwrap();
        if !ready {
            let mut queue = state.pending_open_files.lock().unwrap();
            if !queue.contains(&normalized) {
                queue.push(normalized.clone());
            }
        }
        ready
    };

    if is_ready {
        let _ = app.emit("open-glide-file", normalized);
    }

    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
    }
}

#[tauri::command]
fn take_pending_open_files(state: State<AppState>) -> Vec<String> {
    *state.frontend_ready.lock().unwrap() = true;
    let mut queue = state.pending_open_files.lock().unwrap();
    queue.drain(..).collect()
}

#[tauri::command]
fn read_glide_file(path: String) -> Result<String, String> {
    let cleaned = path.trim().trim_matches('"').trim();
    let file_path = Path::new(cleaned);
    if !is_supported_glide_path(file_path) {
        return Err("Unsupported file type. Expected a .glide or .json file.".to_string());
    }
    std::fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn get_state(state: State<AppState>) -> serde_json::Value {
    state.current_state.lock().unwrap().clone()
}

#[tauri::command]
fn set_state(state: serde_json::Value, app_state: State<AppState>, app: AppHandle) {
    *app_state.current_state.lock().unwrap() = state.clone();
    app.emit("state-changed", state).unwrap();
}

#[tauri::command]
async fn open_presentation_window(app: AppHandle, monitor_index: Option<usize>) {
    if let Some(window) = app.get_webview_window("presentation") {
        window.set_focus().unwrap();
    } else {
        // Detect monitors
        let monitors = app.available_monitors().unwrap_or_default();
        
        // Use requested monitor, or second monitor if available, otherwise primary
        let target_monitor = if let Some(idx) = monitor_index {
            monitors.get(idx).or(monitors.get(1)).unwrap_or(&monitors[0])
        } else if monitors.len() > 1 {
            &monitors[1]
        } else {
            &monitors[0]
        };
        
        let pos = target_monitor.position();

        let window = WebviewWindowBuilder::new(
            &app,
            "presentation",
            WebviewUrl::App("?view=presentation".into())
        )
        .title("Scripture Presentation")
        .position(pos.x as f64, pos.y as f64)
        .fullscreen(true)
        .decorations(false)
        .build()
        .unwrap();

        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                app_handle.emit("presentation-closed", ()).unwrap();
            }
        });
    }
}

#[tauri::command]
async fn close_presentation_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("presentation") {
        window.close().unwrap();
    }
}

#[tauri::command]
async fn list_monitors(app: AppHandle) -> Vec<serde_json::Value> {
    let monitors = app.available_monitors().unwrap_or_default();
    monitors.iter().enumerate().map(|(i, m)| {
        serde_json::json!({
            "index": i,
            "name": m.name().unwrap_or(&format!("Monitor {}", i)),
            "width": m.size().width,
            "height": m.size().height
        })
    }).collect()
}

#[tauri::command]
async fn fetch_url(url: String, headers: Option<std::collections::HashMap<String, String>>) -> Result<String, String> {
    let mut builder = reqwest::Client::builder();
    builder = builder.user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    let client = builder.build().map_err(|e| e.to_string())?;
    let mut req = client.get(&url);
    if let Some(h) = headers {
        for (k, v) in h {
            req = req.header(k, v);
        }
    }
    
    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("Request failed with status: {}", res.status()));
    }
    
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn fetch_youversion(url: String, key: String) -> Result<String, String> {
    let mut builder = reqwest::Client::builder();
    builder = builder.user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    let client = builder.build().map_err(|e| e.to_string())?;
    let res = client.get(&url)
        .header("X-YVP-App-Key", &key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !res.status().is_success() {
        return Err(format!("Request failed with status: {}", res.status()));
    }
    
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.unminimize();
                let _ = main_window.set_focus();
            }
            for arg in argv.iter().skip(1) {
                handle_external_file_path(app, arg);
            }
        }));
    }

    builder
        .manage(AppState {
            current_state: Mutex::new(serde_json::json!({})),
            pending_open_files: Mutex::new(Vec::new()),
            frontend_ready: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            set_state,
            open_presentation_window,
            close_presentation_window,
            list_monitors,
            fetch_youversion,
            fetch_url,
            take_pending_open_files,
            read_glide_file
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            for arg in std::env::args().skip(1) {
                handle_external_file_path(&handle, &arg);
            }
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        if let Some(presentation) = handle.get_webview_window("presentation") {
                            let _ = presentation.close();
                        }
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = _event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if let Some(path_str) = path.to_str() {
                            handle_external_file_path(_app_handle, path_str);
                        }
                    }
                }
            }
        });
}
