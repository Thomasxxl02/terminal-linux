#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod fs;
mod pty;
mod secrets;

use commands::*;
use fs::*;
use secrets::*;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_pty_session,
            list_pty_sessions,
            write_pty_input,
            resize_pty_session,
            close_pty_session,
            get_system_stats,
            secure_set,
            secure_get,
            secure_delete,
            get_source_code,
            fs_tree,
            fs_read,
            fs_write,
            fs_create_file,
            fs_create_directory,
            fs_delete,
            fs_rename,
            check_port,
            check_shells
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du démarrage de l'application Tauri & Rust Terminal");
}
