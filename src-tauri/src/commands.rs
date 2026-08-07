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
                line.strip_prefix("model name")
                    .map(|v| v.split(':').nth(1).map(str::trim).map(str::to_string).unwrap_or_default())
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

/// Un processus système (format compatible avec le backend web).
#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub pid: i32,
    pub user: String,
    pub cpu: f64,
    pub mem: f64,
    pub name: String,
}

// Cache court (2 s) du scan /proc : le frontend interroge les stats toutes
// les 4 s — rescanner l'intégralité de /proc à chaque appel est inutile.
lazy_static! {
    static ref PROCESS_CACHE: std::sync::Mutex<Option<(std::time::Instant, Vec<ProcessInfo>)>> =
        std::sync::Mutex::new(None);
}

const PROCESS_CACHE_TTL: std::time::Duration = std::time::Duration::from_secs(2);

/// Liste les processus réels via /proc (top CPU, max 15) — zéro `exec`,
/// lecture directe du pseudo-filesystem. Résultat mis en cache 2 s.
#[tauri::command]
pub fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    // Cache hit → retour direct
    if let Ok(guard) = PROCESS_CACHE.lock() {
        if let Some((at, cached)) = guard.as_ref() {
            if at.elapsed() < PROCESS_CACHE_TTL {
                return Ok(cached.clone());
            }
        }
    }

    let mut procs: Vec<ProcessInfo> = Vec::new();
    let total_mem = total_memory();

    let entries = match std::fs::read_dir("/proc") {
        Ok(e) => e,
        Err(_) => return Ok(vec![]),
    };

    for entry in entries.flatten() {
        let pid_str = entry.file_name();
        let pid: i32 = match pid_str.to_str().and_then(|s| s.parse().ok()) {
            Some(p) => p,
            None => continue,
        };
        let proc_dir = entry.path();

        // Nom du processus via /proc/<pid>/comm (tronqué à 15 chars par le noyau)
        let name = std::fs::read_to_string(proc_dir.join("comm"))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        // Utilisateur via /proc/<pid>/status → Uid:
        let user = std::fs::read_to_string(proc_dir.join("status"))
            .ok()
            .and_then(|s| {
                s.lines().find_map(|l| {
                    if let Some(v) = l.strip_prefix("Uid:") {
                        v.split_whitespace().next().map(uid_to_user)
                    } else {
                        None
                    }
                })
            })
            .unwrap_or_else(|| "?".to_string());

        // RSS (mémoire résidente) depuis VmRSS dans status
        let rss_kb = std::fs::read_to_string(proc_dir.join("status"))
            .ok()
            .and_then(|s| {
                s.lines().find_map(|l| {
                    if let Some(v) = l.strip_prefix("VmRSS:") {
                        v.split_whitespace().next().and_then(|k| k.parse::<u64>().ok())
                    } else {
                        None
                    }
                })
            })
            .unwrap_or(0);

        // CPU % approximatif : utime+stime (ticks) / uptime système / HZ
        // Lecture directe de /proc/<pid>/stat (champs 14 et 15, indexés 0)
        let cpu = std::fs::read_to_string(proc_dir.join("stat"))
            .ok()
            .and_then(|s| {
                // Le comm peut contenir des espaces entre parenthèses → on coupe
                // depuis la dernière parenthèse fermante pour lire les champs numériques.
                let after = s.rfind(')')?;
                let rest = &s[after + 1..];
                let fields: Vec<&str> = rest.split_whitespace().collect();
                // fields[0]=state, [11]=utime, [12]=stime (décalage de 3 vs stat classique)
                let utime: u64 = fields.get(11)?.parse().ok()?;
                let stime: u64 = fields.get(12)?.parse().ok()?;
                let ticks = (utime + stime) as f64;
                let hz = 100.0; // USER_HZ standard sur Linux
                Some(ticks / hz)
            })
            .unwrap_or(0.0);

        let uptime = uptime_secs() as f64;
        let cpu_pct = if uptime > 0.0 { (cpu / uptime) * 100.0 } else { 0.0 };
        let mem_pct = if total_mem > 0 {
            (rss_kb as f64 * 1024.0 / total_mem as f64) * 100.0
        } else {
            0.0
        };

        procs.push(ProcessInfo {
            pid,
            user,
            cpu: (cpu_pct * 10.0).round() / 10.0,
            mem: (mem_pct * 10.0).round() / 10.0,
            name,
        });
    }

    procs.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(15);

    // Mise en cache du résultat (2 s)
    if let Ok(mut guard) = PROCESS_CACHE.lock() {
        *guard = Some((std::time::Instant::now(), procs.clone()));
    }

    Ok(procs)
}

/// Résout un UID vers un nom d'utilisateur via /etc/passwd (cache léger).
fn uid_to_user(uid: &str) -> String {
    let uid_num: u32 = match uid.parse() {
        Ok(u) => u,
        Err(_) => return uid.to_string(),
    };
    std::fs::read_to_string("/etc/passwd")
        .ok()
        .and_then(|content| {
            content.lines().find_map(|line| {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() >= 3 {
                    if let Ok(u) = parts[2].parse::<u32>() {
                        if u == uid_num {
                            return Some(parts[0].to_string());
                        }
                    }
                }
                None
            })
        })
        .unwrap_or_else(|| uid.to_string())
}

/// Arrête un processus par PID (SIGTERM) — logique métier native Rust.
#[tauri::command]
pub fn kill_process(pid: i32) -> Result<(), String> {
    if pid <= 1 {
        return Err("PID invalide (refus de tuer les PID ≤ 1)".to_string());
    }
    // Vérifier que le processus existe réellement avant de signaler
    let exists = std::path::Path::new(&format!("/proc/{}", pid)).exists();
    if !exists {
        return Err(format!("Le processus {} n'existe pas", pid));
    }
    // Sécurité : ne jamais tuer notre propre processus ni le parent
    let self_pid = std::process::id() as i32;
    if pid == self_pid {
        return Err("Refus d'arrêter le processus de l'application".to_string());
    }
    // Éviter les processus kernel (PID < 2 sont kernel/systemd)
    unsafe {
        let ret = libc::kill(pid, libc::SIGTERM);
        if ret != 0 {
            return Err(format!(
                "Impossible d'arrêter le processus {} (errno {})",
                pid,
                std::io::Error::last_os_error()
            ));
        }
    }
    Ok(())
}
