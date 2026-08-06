use crate::pty::PtyManager;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Wry};
use serde::{Deserialize, Serialize};

lazy_static! {
    pub static ref PTY_SESSIONS: Arc<Mutex<HashMap<String, PtyManager>>> = Arc::new(Mutex::new(HashMap::new()));
    // Métadonnées de session (nom, cwd, shell) — non liées au PTY lui-même
    pub static ref PTY_METADATA: Arc<Mutex<HashMap<String, SessionMeta>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionMeta {
    pub name: String,
    pub cwd: String,
    pub shell: String,
}

#[derive(Serialize, Deserialize)]
pub struct SystemStats {
    pub platform: String,
    pub release: String,
    pub arch: String,
    pub hostname: String,
    pub cpus: usize,
    pub cpu_model: String,
    pub total_mem: u64,
    pub free_mem: u64,
    pub used_mem: u64,
    pub mem_usage_percent: f64,
    pub uptime: u64,
    pub os_release: String,
    pub loadavg: Vec<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct PtySessionInfo {
    pub id: String,
    pub name: String,
    pub shell: String,
    pub cwd: String,
    pub cols: u16,
    pub rows: u16,
}

#[tauri::command]
pub async fn create_pty_session(
    app_handle: AppHandle<Wry>,
    session_id: String,
    cols: u16,
    rows: u16,
    shell_path: Option<String>,
    name: Option<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let pty = PtyManager::new(app_handle, session_id.clone(), cols, rows, shell_path.clone())?;
    let mut sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), pty);

    let mut metadata = PTY_METADATA.lock().map_err(|e| e.to_string())?;
    metadata.insert(
        session_id.clone(),
        SessionMeta {
            name: name.unwrap_or_else(|| format!("Terminal #{}", &session_id[session_id.len().saturating_sub(4)..])),
            cwd: cwd.unwrap_or_else(|| std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default()),
            shell: shell_path.unwrap_or_else(|| "/bin/bash".to_string()),
        },
    );
    Ok(format!("Session PTY Rust créée avec succès : {}", session_id))
}

#[tauri::command]
pub async fn list_pty_sessions() -> Result<Vec<PtySessionInfo>, String> {
    let sessions = PTY_SESSIONS.lock().map_err(|e| e.to_string())?;
    let metadata = PTY_METADATA.lock().map_err(|e| e.to_string())?;
    let mut out: Vec<PtySessionInfo> = Vec::new();
    for (id, pty) in sessions.iter() {
        let (cols, rows) = pty.dimensions();
        let meta = metadata.get(id);
        out.push(PtySessionInfo {
            id: id.clone(),
            name: meta.map(|m| m.name.clone()).unwrap_or_else(|| id.clone()),
            shell: meta.map(|m| m.shell.clone()).unwrap_or_default(),
            cwd: meta.map(|m| m.cwd.clone()).unwrap_or_default(),
            cols,
            rows,
        });
    }
    Ok(out)
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
        if let Ok(mut metadata) = PTY_METADATA.lock() {
            metadata.remove(&session_id);
        }
        Ok(())
    } else {
        Err(format!("Session PTY non trouvée : {}", session_id))
    }
}

#[tauri::command]
pub async fn get_system_stats() -> Result<SystemStats, String> {
    let total_mem = total_memory();
    let free_mem = free_memory();
    let used_mem = total_mem.saturating_sub(free_mem);
    let mem_usage_percent = if total_mem > 0 {
        (used_mem as f64 / total_mem as f64) * 100.0
    } else {
        0.0
    };

    let os_release = std::fs::read_to_string("/proc/sys/kernel/osrelease")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| std::env::consts::OS.to_string());

    let release = std::fs::read_to_string("/proc/sys/kernel/ostype")
        .map(|s| format!("{} {}", s.trim(), os_release))
        .unwrap_or_else(|_| format!("{} {}", std::env::consts::OS, os_release));

    Ok(SystemStats {
        platform: std::env::consts::OS.to_string(),
        release,
        arch: std::env::consts::ARCH.to_string(),
        hostname: hostname(),
        cpus: num_cpus::get_physical(),
        cpu_model: cpu_model(),
        total_mem,
        free_mem,
        used_mem,
        mem_usage_percent,
        uptime: uptime_secs(),
        os_release,
        loadavg: loadavg(),
    })
}

/// Lit /proc/loadavg (3 valeurs : 1/5/15 min). Fallback [0.0, 0.0, 0.0].
fn loadavg() -> Vec<f64> {
    std::fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|s| {
            let parts: Vec<&str> = s.split_whitespace().collect();
            let vals: Vec<f64> = parts
                .iter()
                .take(3)
                .filter_map(|p| p.parse::<f64>().ok())
                .collect();
            if vals.len() == 3 { Some(vals) } else { None }
        })
        .unwrap_or_else(|| vec![0.0, 0.0, 0.0])
}

// ── Helpers système sans dépendance externe ───────────────────────
fn total_memory() -> u64 {
    read_ulong("/proc/meminfo", "MemTotal") * 1024
}

fn free_memory() -> u64 {
    let avail = read_ulong("/proc/meminfo", "MemAvailable");
    if avail > 0 {
        avail * 1024
    } else {
        // Fallback : MemFree + Cached + Buffers
        (read_ulong("/proc/meminfo", "MemFree")
            + read_ulong("/proc/meminfo", "Cached")
            + read_ulong("/proc/meminfo", "Buffers"))
            * 1024
    }
}

fn read_ulong(path: &str, key: &str) -> u64 {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|content| {
            content.lines().find_map(|line| {
                if line.starts_with(key) {
                    line.split_whitespace()
                        .nth(1)
                        .and_then(|v| v.parse::<u64>().ok())
                } else {
                    None
                }
            })
        })
        .unwrap_or(0)
}

fn hostname() -> String {
    std::fs::read_to_string("/proc/sys/kernel/hostname")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

fn cpu_model() -> String {
    std::fs::read_to_string("/proc/cpuinfo")
        .ok()
        .and_then(|content| {
            content.lines().find_map(|line| {
                if let Some(v) = line.strip_prefix("model name") {
                    Some(v.split(':').nth(1).map(|s| s.trim().to_string()).unwrap_or_default())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| "Unknown CPU".to_string())
}

fn uptime_secs() -> u64 {
    std::fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|s| s.split_whitespace().next().and_then(|v| v.parse::<f64>().ok()))
        .map(|v| v as u64)
        .unwrap_or(0)
}
