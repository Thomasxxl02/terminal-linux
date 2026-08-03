import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TauriRustArchitect } from "../components/TauriRustArchitect";

// Mock `@monaco-editor/react` to prevent async/WebGL issues in jsdom environment
vi.mock("@monaco-editor/react", () => {
  return {
    default: ({ value, language }: any) => (
      <textarea
        data-testid="monaco-editor-mock"
        value={value}
        readOnly
        data-language={language}
      />
    ),
  };
});

describe("TauriRustArchitect Component", () => {
  const mockSourceData = {
    cargoToml: "[package]\nname = \"tauri-test\"",
    mainRs: "fn main() { println!(\"hello main\"); }",
    ptyRs: "pub struct PtySession {}",
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

  it("renders the architecture page successfully with title and tabs", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    expect(screen.getByText(/Analyse Comparative d'Architectures de Terminaux/i)).toBeInTheDocument();
    expect(screen.getAllByText("Tauri + Rust (portable-pty)")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Electron + node-pty")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Web Terminal + Passerelle WebSocket")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Native GPU Terminal (Alacritty Style)")[0]).toBeInTheDocument();
  });

  it("displays Tauri + Rust characteristics by default", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    // Default active profile should be Tauri
    expect(screen.getAllByText("Tauri + Rust (portable-pty)")[0]).toBeInTheDocument();
    expect(screen.getByText("< 30 Mo")).toBeInTheDocument();
    expect(screen.getByText("4 Mo - 8 Mo")).toBeInTheDocument();
    expect(screen.getByText(/Tauri Event Bridge & WebGL/i)).toBeInTheDocument();
  });

  it("switches to Electron + node-pty architecture and updates metrics", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    const electronTab = screen.getAllByText("Electron + node-pty")[0];
    await act(async () => {
      fireEvent.click(electronTab);
    });

    // Should display electron metrics
    expect(screen.getByText("150 Mo - 350 Mo")).toBeInTheDocument();
    expect(screen.getByText("80 Mo - 130 Mo")).toBeInTheDocument();
    expect(screen.getAllByText(/VSCode \/ Hyper/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/pont de preload sécurisé/i)).toBeInTheDocument();
  });

  it("switches to Web Terminal architecture and displays websocket pipeline", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    const webTab = screen.getAllByText("Web Terminal + Passerelle WebSocket")[0];
    await act(async () => {
      fireEvent.click(webTab);
    });

    expect(screen.getByText("< 15 Mo (Côté Client)")).toBeInTheDocument();
    expect(screen.getByText("1 Mo - 2 Mo (Code Client)")).toBeInTheDocument();
    expect(screen.getByText(/Converties en trame binaire/i)).toBeInTheDocument();
  });

  it("loads source file content into Monaco mock when switching file tabs", async () => {
    await act(async () => {
      render(<TauriRustArchitect />);
    });

    // Wait for mock fetch to resolve
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const ptyFileTab = screen.getByText("src-tauri/src/pty.rs");
    expect(ptyFileTab).toBeInTheDocument();

    const mainFileTab = screen.getByText("src-tauri/src/main.rs");
    await act(async () => {
      fireEvent.click(mainFileTab);
    });

    const editorMock = screen.getByTestId("monaco-editor-mock");
    expect(editorMock).toHaveValue("fn main() { println!(\"hello main\"); }");
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

    const copyBtn = screen.getByText(/Copier ce fichier de code/i);
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(screen.getByText(/Code Copié !/i)).toBeInTheDocument();
  });
});
