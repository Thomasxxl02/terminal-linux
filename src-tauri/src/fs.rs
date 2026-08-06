use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const MAX_READ_SIZE: u64 = 2 * 1024 * 1024; // 2 Mo
const MAX_TREE_ITEMS: usize = 300;

#[derive(Serialize, Deserialize)]
pub struct FsItem {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
}

#[derive(Serialize)]
pub struct FsTree {
    pub current_path: String,
    pub parent_path: String,
    pub items: Vec<FsItem>,
    pub total_count: usize,
    pub truncated: bool,
}

#[derive(Serialize)]
pub struct FsFile {
    pub path: String,
    pub name: String,
    pub content: String,
    pub extension: String,
}

/// Équivalent desktop des routes web /api/fs/* — mêmes règles de sécurité
/// (taille max, limite d'éléments, existences vérifiées).

#[tauri::command]
pub fn fs_tree(dir: Option<String>) -> Result<FsTree, String> {
    let target = PathBuf::from(dir.unwrap_or_else(|| "/".to_string()));
    if !target.exists() {
        return Err("Dossier introuvable".into());
    }
    if !target.is_dir() {
        return Err("Le chemin spécifié n'est pas un dossier".into());
    }

    let mut entries: Vec<_> = fs::read_dir(&target)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    // Dossiers d'abord, puis tri alphabétique (comme la route web)
    entries.sort_by(|a, b| {
        let a_dir = a.path().is_dir();
        let b_dir = b.path().is_dir();
        b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
    });

    let total_count = entries.len();
    let truncated = total_count > MAX_TREE_ITEMS;
    let items: Vec<FsItem> = entries
        .into_iter()
        .take(MAX_TREE_ITEMS)
        .map(|e| {
            let p = e.path();
            let is_dir = p.is_dir();
            let size = if is_dir {
                0
            } else {
                fs::metadata(&p).map(|m| m.len()).unwrap_or(0)
            };
            FsItem {
                name: e.file_name().to_string_lossy().to_string(),
                path: p.to_string_lossy().to_string(),
                is_directory: is_dir,
                size,
            }
        })
        .collect();

    let parent = target
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    Ok(FsTree {
        current_path: target.to_string_lossy().to_string(),
        parent_path: parent,
        items,
        total_count,
        truncated,
    })
}

#[tauri::command]
pub fn fs_read(path: String) -> Result<FsFile, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Fichier non trouvé".into());
    }
    if p.is_dir() {
        return Err("Le chemin spécifié est un dossier, pas un fichier".into());
    }
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_READ_SIZE {
        return Err("Fichier trop volumineux (> 2Mo)".into());
    }

    let content = fs::read_to_string(&p).map_err(|e| format!("Erreur de lecture : {}", e))?;
    let ext = p
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FsFile {
        path: p.to_string_lossy().to_string(),
        name: p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        content,
        extension: ext,
    })
}

/// Lit les N derniers octets d'un fichier de log (tail réel, pas simulé).
/// Retourne le contenu + la taille totale pour permettre au frontend de
/// calculer les nouveaux octets au prochain polling (LogsStreamer Tauri).
#[tauri::command]
pub fn tail_log_file(path: String, max_bytes: Option<u64>) -> Result<LogTail, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Fichier non trouvé".into());
    }
    if p.is_dir() {
        return Err("Le chemin spécifié est un dossier, pas un fichier".into());
    }

    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    let total_size = meta.len();
    if total_size == 0 {
        return Ok(LogTail {
            total_size: 0,
            content: String::new(),
        });
    }

    let limit = max_bytes.unwrap_or(50 * 1024).min(2 * 1024 * 1024);
    let offset = total_size.saturating_sub(limit);
    let read_len = (total_size - offset) as usize;

    let f = fs::File::open(&p).map_err(|e| e.to_string())?;
    use std::io::{Read, Seek, SeekFrom};
    let mut f = f;
    f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; read_len];
    f.read_exact(&mut buf).map_err(|e| e.to_string())?;

    Ok(LogTail {
        total_size,
        content: String::from_utf8_lossy(&buf).to_string(),
    })
}

#[derive(Serialize, Debug)]
pub struct LogTail {
    pub total_size: u64,
    pub content: String,
}

#[tauri::command]
pub fn fs_write(path: String, content: String, encoding: Option<String>) -> Result<(), String> {
    let p = PathBuf::from(&path);
    // Le parent doit exister (pas de création silencieuse de dossiers)
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("Le dossier parent n'existe pas".into());
        }
    }
    if encoding.as_deref() == Some("base64") {
        let bytes = decode_base64(&content)?;
        fs::write(&p, bytes).map_err(|e| e.to_string())?;
    } else {
        fs::write(&p, content).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn fs_create_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err("Le fichier existe déjà".into());
    }
    fs::write(&p, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_create_directory(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err("Le dossier existe déjà".into());
    }
    fs::create_dir_all(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Élément introuvable".into());
    }
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    let old_p = PathBuf::from(&old_path);
    let new_p = PathBuf::from(&new_path);
    if !old_p.exists() {
        return Err("Source introuvable".into());
    }
    if new_p.exists() {
        return Err("La destination existe déjà".into());
    }
    fs::rename(&old_p, &new_p).map_err(|e| e.to_string())
}

/// Décode du base64 sans dépendance externe (table standard RFC 4648).
fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits = 0u32;
    for c in input.bytes().filter(|b| !b.is_ascii_whitespace()) {
        if c == b'=' {
            break;
        }
        let val = match TABLE.iter().position(|&t| t == c) {
            Some(v) => v as u32,
            None => return Err("Base64 invalide".into()),
        };
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Ok(out)
}

/// Vérifie si un port local est libre en tentant un bind TCP réel
/// (remplace l'ancien "port checker" simulé qui devinait avec une table).
#[tauri::command]
pub fn check_port(port: u16) -> Result<bool, String> {
    use std::net::TcpListener;
    match TcpListener::bind(("127.0.0.1", port)) {
        Ok(_) => Ok(true),   // libre
        Err(_) => Ok(false), // occupé
    }
}

/// Vérifie la présence RÉELLE des shells sur le système (audit de compatibilité).
/// Retourne pour chaque shell : présent ou non + version détectée.
#[tauri::command]
pub fn check_shells() -> Result<Vec<serde_json::Value>, String> {
    use std::process::Command;

    let candidates: Vec<(&str, &str)> = vec![
        ("bash", "/bin/bash"),
        ("bash", "/usr/bin/bash"),
        ("zsh", "/bin/zsh"),
        ("zsh", "/usr/bin/zsh"),
        ("sh", "/bin/sh"),
        ("dash", "/bin/dash"),
        ("fish", "/usr/bin/fish"),
        ("ksh", "/bin/ksh"),
    ];

    let mut results: Vec<serde_json::Value> = Vec::new();
    let mut seen: Vec<String> = Vec::new();

    for (name, path) in candidates {
        if seen.contains(&name.to_string()) {
            continue; // déjà trouvé via un autre chemin
        }
        let present = PathBuf::from(path).exists();
        let version = if present {
            Command::new(path)
                .arg("--version")
                .output()
                .ok()
                .map(|o| {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    let stderr = String::from_utf8_lossy(&o.stderr);
                    let raw = format!("{}{}", stdout, stderr);
                    raw.lines().next().unwrap_or("").trim().to_string()
                })
                .unwrap_or_default()
        } else {
            String::new()
        };
        if present {
            seen.push(name.to_string());
        }
        results.push(serde_json::json!({
            "name": name,
            "path": path,
            "present": present,
            "version": version,
        }));
    }

    // TERM / COLORTERM réels
    let term = std::env::var("TERM").unwrap_or_else(|_| "non défini".to_string());
    let colorterm = std::env::var("COLORTERM").unwrap_or_else(|_| "non défini".to_string());
    results.push(serde_json::json!({ "name": "env", "path": "", "present": true, "version": format!("TERM={} COLORTERM={}", term, colorterm) }));

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_log(name: &str, content: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("fs-test-{}-{}.log", std::process::id(), name));
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn tail_log_file_lit_la_fin_du_fichier() {
        let path = temp_log("fin", "ligne1\nligne2\nligne3\n");
        let tail = tail_log_file(path.to_string_lossy().to_string(), Some(10)).unwrap();
        assert_eq!(tail.total_size, 21); // "ligne1\nligne2\nligne3\n" = 7+7+7
        // 10 derniers octets → "ligne2\nligne3\n" partiel couvrant ligne3
        assert!(tail.content.contains("ligne3"));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn tail_log_file_retourne_erreur_si_fichier_absent() {
        let err = tail_log_file("/tmp/fichier-inexistant-xyz.log".into(), None).unwrap_err();
        assert!(err.contains("non trouvé"));
    }

    #[test]
    fn tail_log_file_gere_fichier_vide() {
        let path = temp_log("vide", "");
        let tail = tail_log_file(path.to_string_lossy().to_string(), None).unwrap();
        assert_eq!(tail.total_size, 0);
        assert_eq!(tail.content, "");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn tail_log_file_refuse_un_dossier() {
        let err = tail_log_file(std::env::temp_dir().to_string_lossy().to_string(), None).unwrap_err();
        assert!(err.contains("dossier"));
    }
}
