use crate::pty::PtyManager;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Wry};
use serde::{Deserialize, Serialize};

lazy_static! {
    pub static ref PTY_SESSIONS: Arc<Mutex<HashMap<String, PtyManager>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Serialize, Deserialize)]
pub struct SystemStats {
    pub platform: String,
    pub arch: String,
    pub cpus: usize,
    pub os_release: String,
}

#[tauri::command]
pub async fn create_pty_session(
    app_handle: AppHandle<Wry>,
    session_id: String,
    cols: u16,
    rows: u16,
    shell_path: Option<String>,
) -> Result<String, String> {
    let pty = PtyManager::new(app_handle, session_id.clone(), cols, rows, shell_path)?;
    let mut sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), pty);
    Ok(format!("Session PTY Rust créée avec succès : {}", session_id))
}

#[tauri::command]
pub async fn write_pty_input(session_id: String, data: String) -> Result<(), String> {
    let sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    if let Some(pty) = sessions.get(&session_id) {
        pty.write_input(&data)?;
        Ok(())
    } else {
        Err(format!("Session PTY non trouvée : {}", session_id))
    }
}

#[tauri::command]
pub async fn resize_pty_session(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    if let Some(pty) = sessions.get(&session_id) {
        pty.resize(cols, rows)?;
        Ok(())
    } else {
        Err(format!("Session PTY non trouvée : {}", session_id))
    }
}

#[tauri::command]
pub async fn close_pty_session(session_id: String) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    if let Some(pty) = sessions.remove(&session_id) {
        // Tuer le shell sous-jacent pour éviter les processus orphelins
        pty.kill()?;
        Ok(())
    } else {
        Err(format!("Session PTY non trouvée : {}", session_id))
    }
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    Ok(SystemStats {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpus: num_cpus::get_physical(),
        os_release: std::fs::read_to_string("/proc/sys/kernel/osrelease")
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| std::env::consts::OS.to_string()),
    })
}
