use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Wry};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PtyPipedData {
    pub session_id: String,
    pub data: String,
}

/// Core PTY session structure containing the underlying OS process PTY pair and its writer.
/// This decouples PTY process execution and OS communication from Tauri's IPC system,
/// enabling robust native unit testing.
pub struct PtySession {
    pub pair: PtyPair,
    pub writer: Box<dyn Write + Send>,
}

impl PtySession {
    pub fn new(cols: u16, rows: u16, shell_path: Option<String>) -> Result<Self, String> {
        let pty_system = native_pty_system();
        
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Erreur création PTY Rust portable-pty: {}", e))?;

        let shell = shell_path.unwrap_or_else(|| {
            if std::path::Path::new("/bin/zsh").exists() {
                "/bin/zsh".to_string()
            } else {
                "/bin/bash".to_string()
            }
        });

        let mut cmd = CommandBuilder::new(&shell);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Impossible de démarrer le sous-processus shell {}: {}", shell, e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Erreur obtention écriture PTY: {}", e))?;

        Ok(Self {
            pair,
            writer,
        })
    }

    pub fn write_input(&mut self, data: &str) -> Result<(), String> {
        self.writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Erreur écriture PTY: {}", e))?;
        self.writer.flush().map_err(|e| format!("Erreur flush PTY: {}", e))?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.pair.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Erreur redimensionnement PTY: {}", e))?;
        Ok(())
    }
}

/// Wraps PtySession and handles the background reader thread emitting Tauri IPC events.
pub struct PtyManager {
    pub session: Arc<Mutex<PtySession>>,
}

impl PtyManager {
    pub fn new(app_handle: AppHandle<Wry>, session_id: String, cols: u16, rows: u16, shell_path: Option<String>) -> Result<Self, String> {
        let session = PtySession::new(cols, rows, shell_path)?;
        
        let mut reader = session.pair.master
            .try_clone_reader()
            .map_err(|e| format!("Erreur clone lecture PTY: {}", e))?;

        let sid_clone = session_id.clone();
        let handle_clone = app_handle.clone();

        // Thread asynchrone non-bloquant pour écouter la sortie PTY et émettre l'événement Tauri IPC
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF process
                    Ok(n) => {
                        let data_str = String::from_utf8_lossy(&buf[..n]).to_string();
                        let payload = PtyPipedData {
                            session_id: sid_clone.clone(),
                            data: data_str,
                        };
                        let _ = handle_clone.emit_all("pty-output", payload);
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            session: Arc::new(Mutex::new(session)),
        })
    }

    pub fn write_input(&self, data: &str) -> Result<(), String> {
        let mut session = self.session.lock().map_err(|e| e.to_string())?;
        session.write_input(data)
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let session = self.session.lock().map_err(|e| e.to_string())?;
        session.resize(cols, rows)
    }
}

// ==================== Rust Backend Unit Tests ====================
#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn test_pty_creation_and_lifecycle() {
        // Test high-performance PTY lifecycle initiation
        let session = PtySession::new(80, 24, None);
        assert!(session.is_ok(), "Le bridge PTY Rust devrait être initialisé avec succès");
        
        let session = session.unwrap();
        // Verify we can resize the master terminal grid dynamically
        let resize_res = session.resize(120, 40);
        assert!(resize_res.is_ok(), "Le redimensionnement de la grille PTY à 120x40 devrait réussir");
    }

    #[test]
    fn test_bidirectional_data_transfer() {
        // Test asynchronous bidirectional data flow (stdin writing and output streaming)
        let mut session = PtySession::new(80, 24, None).expect("Impossible d'initialiser PtySession pour test bidirectionnel");
        
        let mut reader = session.pair.master.try_clone_reader().expect("Impossible de cloner le reader PTY master");
        
        // Write echo command to write input
        let test_cmd = "echo 'RUST_PTY_BRIDGE_SUCCESS'\n";
        session.write_input(test_cmd).expect("Échec de l'écriture de la commande echo dans le PTY");

        // Spawn a monitoring loop with short sleeps to accumulate buffer output asynchronously
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut buf = [0u8; 1024];
            let mut accumulated = String::new();
            let start = Instant::now();
            
            // Read stream for up to 3 seconds or until we capture our target token
            while start.elapsed() < Duration::from_secs(3) {
                if let Ok(n) = reader.read(&mut buf) {
                    if n > 0 {
                        accumulated.push_str(&String::from_utf8_lossy(&buf[..n]));
                        if accumulated.contains("RUST_PTY_BRIDGE_SUCCESS") {
                            let _ = tx.send(accumulated.clone());
                            return;
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            let _ = tx.send(accumulated);
        });

        // Set test receive timeout
        let result = rx.recv_timeout(Duration::from_secs(4));
        assert!(result.is_ok(), "Le test d'attente de sortie du PTY a expiré (timeout)");
        
        let output = result.unwrap();
        assert!(
            output.contains("RUST_PTY_BRIDGE_SUCCESS"),
            "La sortie PTY ne contient pas le jeton attendu. Reçu: {}",
            output
        );
    }
}
