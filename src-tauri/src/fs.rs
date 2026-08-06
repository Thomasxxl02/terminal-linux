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
