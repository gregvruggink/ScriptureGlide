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

fn is_same_monitor(a: &tauri::Monitor, b: &tauri::Monitor) -> bool {
    a.position().x == b.position().x
        && a.position().y == b.position().y
        && a.size().width == b.size().width
        && a.size().height == b.size().height
        && a.name() == b.name()
}

fn resolve_target_monitor(app: &AppHandle, monitor_index: Option<usize>) -> Option<tauri::Monitor> {
    let monitors = app.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        return app.primary_monitor().ok().flatten();
    }
    if let Some(idx) = monitor_index {
        if let Some(m) = monitors.get(idx) {
            return Some(m.clone());
        }
    }
    if let Ok(Some(primary)) = app.primary_monitor() {
        if let Some(non_primary) = monitors.iter().find(|m| !is_same_monitor(m, &primary)) {
            return Some(non_primary.clone());
        }
    }
    monitors.get(1).or_else(|| monitors.first()).cloned()
}

fn move_window_to_monitor_fullscreen(window: &tauri::WebviewWindow, target: &tauri::Monitor) {
    let pos = *target.position();
    let size = *target.size();
    let safe_w = (size.width / 2).max(200);
    let safe_h = (size.height / 2).max(200);
    // Use an interior rect strictly inside `target` (away from the x == pos.x shared border with Monitor 0)
    // so Windows MonitorFromWindow and tao's inclusive monitor bounds never snap to the primary monitor.
    let safe_x = pos.x + ((size.width as i32 - safe_w as i32) / 2);
    let safe_y = pos.y + ((size.height as i32 - safe_h as i32) / 2);

    let _ = window.set_fullscreen(false);
    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(safe_w, safe_h)));
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(safe_x, safe_y)));
    std::thread::sleep(std::time::Duration::from_millis(50));
    let _ = window.set_fullscreen(true);
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
async fn open_presentation_window(app: AppHandle, monitor_index: Option<usize>) {
    let Some(target_monitor) = resolve_target_monitor(&app, monitor_index) else {
        return;
    };

    if let Some(window) = app.get_webview_window("presentation") {
        move_window_to_monitor_fullscreen(&window, &target_monitor);
    } else {
        let pos = *target_monitor.position();
        let size = *target_monitor.size();
        let scale = target_monitor.scale_factor().max(1.0);
        let safe_w = (size.width / 2).max(200);
        let safe_h = (size.height / 2).max(200);
        let safe_x = pos.x + ((size.width as i32 - safe_w as i32) / 2);
        let safe_y = pos.y + ((size.height as i32 - safe_h as i32) / 2);

        let window = WebviewWindowBuilder::new(
            &app,
            "presentation",
            WebviewUrl::App("?view=presentation".into())
        )
        .title("Scripture Presentation")
        .visible(false)
        .decorations(false)
        .position((safe_x as f64) / scale, (safe_y as f64) / scale)
        .inner_size((safe_w as f64) / scale, (safe_h as f64) / scale)
        .build()
        .unwrap();

        move_window_to_monitor_fullscreen(&window, &target_monitor);

        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = app_handle.emit("presentation-closed", ());
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
    let primary = app.primary_monitor().ok().flatten();
    monitors.iter().enumerate().map(|(i, m)| {
        let is_primary = primary
            .as_ref()
            .map(|p| is_same_monitor(m, p))
            .unwrap_or(i == 0);
        serde_json::json!({
            "index": i,
            "name": m.name().unwrap_or(&format!("Monitor {}", i)),
            "width": m.size().width,
            "height": m.size().height,
            "x": m.position().x,
            "y": m.position().y,
            "scaleFactor": m.scale_factor(),
            "isPrimary": is_primary
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
