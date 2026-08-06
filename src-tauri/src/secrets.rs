use keyring::Entry;
use std::path::PathBuf;

/// Service name utilisé dans le keyring OS (GNOME Keyring / Keychain / Credential Manager)
const KEYRING_SERVICE: &str = "com.tauri.linuxterminal";

fn entry_for(key: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, key).map_err(|e| format!("Erreur keyring (création) : {}", e))
}

/// Stocke un secret dans le keyring OS (remplace la fausse "obfuscation" XOR).
#[tauri::command]
pub async fn secure_set(key: String, value: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    entry
        .set_password(&value)
        .map_err(|e| format!("Erreur keyring (écriture) : {}", e))
}

/// Lit un secret depuis le keyring OS. Retourne null si absent.
#[tauri::command]
pub async fn secure_get(key: String) -> Result<Option<String>, String> {
    let entry = entry_for(&key)?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Erreur keyring (lecture) : {}", e)),
    }
}

/// Supprime un secret du keyring OS.
#[tauri::command]
pub async fn secure_delete(key: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Erreur keyring (suppression) : {}", e)),
    }
}

/// Lit les VRAIS fichiers source Rust du backend (affichage dans le panneau
/// "Architecture Rust"). Retourne le contenu brut, vide si le fichier manque.
#[tauri::command]
pub fn get_source_code() -> Result<serde_json::Value, String> {
    let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
    let read = |f: &str| std::fs::read_to_string(src_dir.join(f)).unwrap_or_default();
    let conf_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let read_conf = |f: &str| std::fs::read_to_string(conf_dir.join(f)).unwrap_or_default();

    Ok(serde_json::json!({
        "cargoToml": read_conf("Cargo.toml"),
        "mainRs": read("main.rs"),
        "ptyRs": read("pty.rs"),
        "commandsRs": read("commands.rs"),
        "secretsRs": read("secrets.rs"),
        "tauriConfJson": read_conf("tauri.conf.json"),
    }))
}
