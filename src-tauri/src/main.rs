#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod pty;

use commands::*;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_pty_session,
            list_pty_sessions,
            write_pty_input,
            resize_pty_session,
            close_pty_session,
            get_system_stats
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application Tauri & Rust Terminal");
}
