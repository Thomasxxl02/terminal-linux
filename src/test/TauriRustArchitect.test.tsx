import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TauriRustArchitect } from "../components/TauriRustArchitect";

describe("TauriRustArchitect Component", () => {
  const mockSourceData = {
    cargoToml: "[package]\nname = \"tauri-linux-terminal\"",
    mainRs: "fn main() { println!(\"Hello from Tauri!\"); }",
    ptyRs: "pub struct PtySession {}",
    commandsRs: "pub async fn create_pty_session() {}",
    secretsRs: "pub async fn secure_set() {}",
    tauriConfJson: "{ \"tauri\": {} }",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/tauri/source")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSourceData),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });
  });

  it("renders the Rust architecture page with title", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    expect(screen.getByText(/Architecture Rust du backend Tauri/i)).toBeInTheDocument();
  });

  it("lists the real registered Tauri commands", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    expect(screen.getByText("create_pty_session")).toBeInTheDocument();
    expect(screen.getByText("write_pty_input")).toBeInTheDocument();
    expect(screen.getByText("close_pty_session")).toBeInTheDocument();
    expect(screen.getByText("secure_set")).toBeInTheDocument();
    expect(screen.getByText("get_system_stats")).toBeInTheDocument();
    // Aucune mention d'Electron (vestige supprimé)
    expect(screen.queryByText(/Electron/i)).not.toBeInTheDocument();
  });

  it("loads real Rust source files into the code viewer", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Le contenu réel de pty.rs est affiché quand on clique sur son onglet
    const ptyTab = screen.getByText("pty.rs");
    await act(async () => {
      fireEvent.click(ptyTab);
    });

    expect(screen.getByText("pub struct PtySession {}")).toBeInTheDocument();
  });

  it("handles copy button click", async () => {
    // Mock clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    await act(async () => {
      render(<TauriRustArchitect />);
    });

    const copyBtn = screen.getByRole("button", { name: /Copier/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText(/Copié !/i)).toBeInTheDocument();
  });
});
