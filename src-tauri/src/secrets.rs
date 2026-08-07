use keyring::Entry;
use std::path::PathBuf;

/// Service name utilisé dans le keyring OS (GNOME Keyring / Keychain / Credential Manager)
const KEYRING_SERVICE: &str = "com.tauri.linuxterminal";

fn entry_for(key: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, key).map_err(|e| format!("Erreur keyring (création) : {}", e))
}

/// Stocke un secret dans le keyring OS (remplace la fausse "obfuscation" XOR).
#[tauri::command]
pub fn secure_set(key: String, value: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    entry
        .set_password(&value)
        .map_err(|e| format!("Erreur keyring (écriture) : {}", e))
}

/// Lit un secret depuis le keyring OS. Retourne null si absent.
#[tauri::command]
pub fn secure_get(key: String) -> Result<Option<String>, String> {
    let entry = entry_for(&key)?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Erreur keyring (lecture) : {}", e)),
    }
}

/// Supprime un secret du keyring OS.
#[tauri::command]
pub fn secure_delete(key: String) -> Result<(), String> {
    let entry = entry_for(&key)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Erreur keyring (suppression) : {}", e)),
    }
}

/// Lit les VRAIS fichiers source du projet selon le groupe demandé
/// (affichage dans le panneau "Architectures"). Retourne un objet
/// { clé: contenu } — contenu vide si le fichier manque.
/// Groupes : "rust", "backend", "frontend", "config".
#[tauri::command]
pub fn get_source_code(group: String) -> Result<serde_json::Value, String> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")); // src-tauri/
    let project_root = manifest
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| manifest.clone());
    let read = |p: &std::path::Path| std::fs::read_to_string(p).unwrap_or_default();
    let mut out = serde_json::Map::new();

    let insert = |out: &mut serde_json::Map<String, serde_json::Value>, key: &str, path: std::path::PathBuf| {
        out.insert(key.to_string(), serde_json::Value::String(read(&path)));
    };

    match group.as_str() {
        "rust" => {
            let src = manifest.join("src");
            insert(&mut out, "mainRs", src.join("main.rs"));
            insert(&mut out, "ptyRs", src.join("pty.rs"));
            insert(&mut out, "commandsRs", src.join("commands.rs"));
            insert(&mut out, "secretsRs", src.join("secrets.rs"));
            insert(&mut out, "fsRs", src.join("fs.rs"));
            insert(&mut out, "cargoToml", manifest.join("Cargo.toml"));
            insert(&mut out, "tauriConfJson", manifest.join("tauri.conf.json"));
        }
        "backend" => {
            let backend = project_root.join("src").join("backend");
            insert(&mut out, "serverTs", project_root.join("server.ts"));
            insert(&mut out, "routesTs", backend.join("routes.ts"));
            insert(&mut out, "authTs", backend.join("auth.ts"));
            insert(&mut out, "servicesTs", backend.join("services.ts"));
            insert(&mut out, "syncTs", backend.join("sync.ts"));
            insert(&mut out, "securityTs", backend.join("security.ts"));
        }
        "frontend" => {
            let src = project_root.join("src");
            insert(&mut out, "appTsx", src.join("App.tsx"));
            insert(&mut out, "mainTsx", src.join("main.tsx"));
            insert(&mut out, "apiTs", src.join("lib").join("api.ts"));
            insert(&mut out, "tauriTs", src.join("lib").join("tauri.ts"));
            insert(&mut out, "fsApiTs", src.join("lib").join("fsApi.ts"));
            insert(&mut out, "secureStorageTs", src.join("lib").join("secureStorage.ts"));
            insert(&mut out, "typesTs", src.join("types.ts"));
        }
        "config" => {
            insert(&mut out, "packageJson", project_root.join("package.json"));
            insert(&mut out, "viteConfigTs", project_root.join("vite.config.ts"));
            insert(&mut out, "tsconfigJson", project_root.join("tsconfig.json"));
            insert(&mut out, "rustYml", project_root.join(".github").join("workflows").join("rust.yml"));
            insert(&mut out, "webpackYml", project_root.join(".github").join("workflows").join("webpack.yml"));
        }
        "python" => {
            let py = project_root.join("scripts").join("python");
            insert(&mut out, "systemHealthPy", py.join("system_health.py"));
            insert(&mut out, "diskUsagePy", py.join("disk_usage.py"));
        }
        "css" => {
            insert(&mut out, "indexCss", project_root.join("src").join("index.css"));
            insert(&mut out, "indexHtml", project_root.join("index.html"));
        }
        "markdown" => {
            insert(&mut out, "readmeMd", project_root.join("README.md"));
            insert(&mut out, "securityMd", project_root.join("SECURITY.md"));
        }
        _ => return Err(format!("Groupe inconnu : {}", group)),
    }

    Ok(serde_json::Value::Object(out))
}
