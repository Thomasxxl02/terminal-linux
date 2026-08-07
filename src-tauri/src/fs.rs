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

    // Un seul appel metadata par entrée (is_dir + len ensemble), puis tri
    // sur les données pré-calculées — évite O(n log n) appels metadata
    // dans la comparaison de tri.
    let mut entries: Vec<(String, bool, u64)> = fs::read_dir(&target)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .filter_map(|e| {
            let meta = fs::metadata(e.path()).ok()?;
            Some((e.file_name().to_string_lossy().to_string(), meta.is_dir(), if meta.is_dir() { 0 } else { meta.len() }))
        })
        .collect();
    // Dossiers d'abord, puis tri alphabétique (comme la route web)
    entries.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

    let total_count = entries.len();
    let truncated = total_count > MAX_TREE_ITEMS;
    let items: Vec<FsItem> = entries
        .into_iter()
        .take(MAX_TREE_ITEMS)
        .map(|(name, is_dir, size)| FsItem {
            path: target.join(&name).to_string_lossy().to_string(),
            name,
            is_directory: is_dir,
            size,
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
    // Un seul appel metadata (exists + is_dir + len ensemble)
    let meta = match fs::metadata(&p) {
        Ok(m) => m,
        Err(_) => return Err("Fichier non trouvé".into()),
    };
    if meta.is_dir() {
        return Err("Le chemin spécifié est un dossier, pas un fichier".into());
    }
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
    // Garde-fou : jamais d'écrasement d'un fichier système critique.
    if is_critical_system_file(&p) {
        return Err("Écriture refusée : fichier système critique".into());
    }
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

/// Chemins système dont la SUPPRESSION ou le RENOMMAGE est interdit,
/// y compris tous leurs sous-dossiers. Évite qu'un mauvais chemin (bug
/// UI, faute de frappe, frontend compromis) ne supprime la machine.
const PROTECTED_PREFIXES: &[&str] = &[
    "/etc", "/usr", "/bin", "/sbin", "/boot", "/dev", "/proc", "/sys",
    "/lib", "/lib64", "/var", "/snap",
];
/// Racines protégées uniquement pour elles-mêmes (les enfants restent
/// manipulables : /home/user est supprimable, /home ne l'est pas).
const PROTECTED_EXACT: &[&str] = &["/", "/home", "/root", "/media", "/mnt"];

fn is_protected_path(p: &std::path::Path) -> bool {
    // Résout les `..` et les symlinks (quand le chemin existe)
    let resolved = p.canonicalize().unwrap_or_else(|_| p.to_path_buf());
    let s = resolved.to_string_lossy();
    for prefix in PROTECTED_PREFIXES {
        if s == *prefix || s.starts_with(&format!("{}/", prefix)) {
            return true;
        }
    }
    for exact in PROTECTED_EXACT {
        if s == *exact {
            return true;
        }
    }
    // Le home utilisateur lui-même (pas ses enfants)
    if let Ok(home) = std::env::var("HOME") {
        if !home.is_empty() && s == home {
            return true;
        }
    }
    false
}

/// Fichiers CRITIQUES dont l'ÉCRASEMENT est interdit (même admin) :
/// les écraser verrouillerait la machine (passwd/shadow/sudoers) ou
/// casserait la confiance (clés host SSH). Miroir du backend web.
const CRITICAL_FILES: &[&str] = &[
    "/etc/passwd", "/etc/shadow", "/etc/group", "/etc/gshadow",
    "/etc/sudoers", "/etc/sudoers.d", "/etc/fstab", "/etc/crypttab",
    "/etc/ssh/ssh_host_rsa_key", "/etc/ssh/ssh_host_ed25519_key",
    "/etc/ssh/ssh_host_ecdsa_key", "/etc/ssh/sshd_config",
];

fn is_critical_system_file(p: &std::path::Path) -> bool {
    let resolved = p.canonicalize().unwrap_or_else(|_| p.to_path_buf());
    let s = resolved.to_string_lossy();
    CRITICAL_FILES.iter().any(|c| s == *c || s.starts_with(&format!("{}/", c)))
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("Élément introuvable".into());
    }
    // Garde-fou : ne jamais supprimer un chemin système critique.
    if is_protected_path(&p) {
        return Err("Suppression refusée : chemin système protégé".into());
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
    // Garde-fou : pas de renommage d'un chemin système critique.
    if is_protected_path(&old_p) {
        return Err("Renommage refusé : chemin système protégé".into());
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

    // ── Garde-fous des chemins destructifs (fs_delete / fs_rename) ──

    #[test]
    fn is_protected_path_refuse_la_racine() {
        assert!(is_protected_path(std::path::Path::new("/")));
    }

    #[test]
    fn is_protected_path_refuse_etc_et_ses_sous_chemins() {
        assert!(is_protected_path(std::path::Path::new("/etc")));
        assert!(is_protected_path(std::path::Path::new("/etc/passwd")));
        assert!(is_protected_path(std::path::Path::new("/usr/bin")));
    }

    #[test]
    fn is_protected_path_refuse_le_home_mais_pas_ses_enfants() {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/root".into());
        assert!(is_protected_path(std::path::Path::new(&home)));
        // Un sous-dossier du home reste manipulable
        let child = std::path::Path::new(&home).join("mon-projet");
        assert!(!is_protected_path(&child));
    }

    #[test]
    fn fs_delete_refuse_un_chemin_systeme() {
        let err = fs_delete("/etc/passwd".into()).unwrap_err();
        assert!(err.contains("protégé"));
    }

    #[test]
    fn fs_delete_fonctionne_sur_un_fichier_temporaire() {
        let path = temp_log("del", "contenu");
        fs_delete(path.to_string_lossy().to_string()).unwrap();
        assert!(!path.exists());
    }

    #[test]
    fn fs_rename_refuse_un_chemin_systeme() {
        let err = fs_rename("/etc/passwd".into(), "/tmp/passwd-move".into()).unwrap_err();
        assert!(err.contains("protégé"));
    }

    #[test]
    fn fs_write_refuse_un_fichier_critique() {
        let err = fs_write("/etc/passwd".into(), "hacked".into(), None).unwrap_err();
        assert!(err.contains("critique"));
    }

    #[test]
    fn fs_write_fonctionne_sur_un_fichier_normal() {
        let path = temp_log("write", "old");
        fs_write(path.to_string_lossy().to_string(), "nouveau contenu".into(), None).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "nouveau contenu");
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn fs_tree_trie_les_dossiers_dabord() {
        // Créer un dossier de test avec un fichier et un sous-dossier
        let dir = std::env::temp_dir().join(format!("fs-tree-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("zz-sous-dossier")).unwrap();
        std::fs::write(dir.join("aa-fichier.txt"), "x").unwrap();

        let tree = fs_tree(Some(dir.to_string_lossy().to_string())).unwrap();
        // Dossiers d'abord (zz-sous-dossier avant aa-fichier malgré l'ordre alpha)
        assert_eq!(tree.items[0].name, "zz-sous-dossier");
        assert!(tree.items[0].is_directory);
        assert_eq!(tree.items[1].name, "aa-fichier.txt");
        assert!(!tree.items[1].is_directory);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn fs_tree_refuse_un_fichier() {
        let path = temp_log("tree-refuse", "contenu");
        // match au lieu d'unwrap_err (FsTree n'implémente pas Debug)
        let err = match fs_tree(Some(path.to_string_lossy().to_string())) {
            Err(e) => e,
            Ok(_) => panic!("fs_tree devrait refuser un fichier"),
        };
        assert!(err.contains("pas un dossier"));
        std::fs::remove_file(&path).ok();
    }
}
