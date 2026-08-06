use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Service name utilisé dans le keyring OS (GNOME Keyring / Keychain / Credential Manager)
const KEYRING_SERVICE: &str = "com.tauri.linuxterminal";

#[derive(Serialize, Deserialize)]
pub struct SecretEntry {
    pub key: String,
    pub value: String,
}

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
