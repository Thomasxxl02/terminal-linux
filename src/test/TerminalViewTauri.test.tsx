import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalView } from "../components/TerminalView";

// ── Mocks xterm (mêmes classes constructibles que TerminalView.test.tsx) ──
let lastTerminalInstance: { write: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; getSelection: ReturnType<typeof vi.fn> } | null = null;
let onDataCallback: ((data: string) => void) | null = null;
let lastFitAddon: { fit: ReturnType<typeof vi.fn>; proposeDimensions: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } | null = null;
let resizeObserverCallback: ResizeObserverCallback | null = null;

vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    open = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn((cb: (d: string) => void) => {
      onDataCallback = cb;
      return { dispose: vi.fn() };
    });
    write = vi.fn();
    clear = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    getSelection = vi.fn(() => "");
    options: Record<string, unknown> = {};
    cols = 80;
    rows = 24;
    constructor() {
      lastTerminalInstance = this;
    }
  }
  return { Terminal: MockTerminal };
});

vi.mock("@xterm/addon-fit", () => {
  class MockFitAddon {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
    dispose = vi.fn();
    constructor() {
      lastFitAddon = this;
    }
  }
  return { FitAddon: MockFitAddon };
});

vi.mock("@xterm/addon-search", () => {
  class MockSearchAddon {
    findNext = vi.fn();
    findPrevious = vi.fn();
    dispose = vi.fn();
    constructor() {
      // addon chargé mais non référencé (aucun test ne l'interroge)
    }
  }
  return { SearchAddon: MockSearchAddon };
});

vi.mock("@xterm/addon-web-links", () => {
  class MockWebLinksAddon {
    dispose = vi.fn();
  }
  return { WebLinksAddon: MockWebLinksAddon };
});

vi.mock("@xterm/addon-webgl", () => {
  class MockWebglAddon {
    onContextLoss = vi.fn();
    dispose = vi.fn();
  }
  return { WebglAddon: MockWebglAddon };
});

// ── Mode Tauri : isTauri → true, tauriListen capture le listener ──
let ptyListener: ((payload: { session_id: string; data: string }) => void) | null = null;

vi.mock("../lib/tauri", () => ({
  isTauri: () => true,
  tauriInvoke: vi.fn().mockResolvedValue({ id: "session-1" }),
  tauriListen: vi.fn().mockImplementation((_event: string, cb: (p: unknown) => void) => {
    ptyListener = cb as (p: { session_id: string; data: string }) => void;
    return Promise.resolve(() => {
      ptyListener = null;
    });
  }),
  PtyOutputEvent: "pty-output",
}));

import { tauriInvoke, tauriListen } from "../lib/tauri";

describe("TerminalView — mode Tauri (PTY Rust)", () => {
  const mockSession = {
    id: "session-1",
    name: "Bash Main",
    shell: "bash",
    cwd: "/home/user",
    createdAt: Date.now(),
  };

  const defaultProps = {
    session: mockSession,
    activeThemeId: "dracula",
    onThemeChange: vi.fn(),
    fontSize: 14,
    setFontSize: vi.fn(),
    notificationsEnabled: true,
    onOpenMonacoFile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ptyListener = null;
    lastTerminalInstance = null;
    onDataCallback = null;
    lastFitAddon = null;
    resizeObserverCallback = null;
    localStorage.clear();
    // ResizeObserver qui capture le callback (debounce 50ms du resize)
    global.ResizeObserver = class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(cb: ResizeObserverCallback) {
        resizeObserverCallback = cb;
      }
    } as unknown as typeof ResizeObserver;
  });

  it("crée la session via tauriInvoke et écoute pty-output", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    // La session est créée dans le processus Rust
    expect(tauriInvoke).toHaveBeenCalledWith(
      "create_pty_session",
      expect.objectContaining({ sessionId: "session-1" })
    );
    // L'écouteur d'événements est abonné
    expect(tauriListen).toHaveBeenCalledWith("pty-output", expect.any(Function));
  });

  it("affiche la sortie reçue par l'événement pty-output", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    // La connexion est établie
    await waitFor(() => {
      expect(lastTerminalInstance).not.toBeNull();
    });

    // Événement Tauri : sortie du PTY Rust → écrite dans xterm
    await act(async () => {
      ptyListener?.({ session_id: "session-1", data: "bonjour depuis le PTY Rust\n" });
    });

    expect(lastTerminalInstance?.write).toHaveBeenCalledWith("bonjour depuis le PTY Rust\n");
  });

  it("ignore la sortie d'une AUTRE session (filtre par session_id)", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      ptyListener?.({ session_id: "autre-session", data: "ne doit pas s'afficher\n" });
    });

    expect(lastTerminalInstance?.write).not.toHaveBeenCalled();
  });

  it("signale une erreur si tauriInvoke échoue", async () => {
    (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("PTY rust indisponible"));

    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(lastTerminalInstance).not.toBeNull();
    });
    // Le statut d'erreur est affiché dans le toolbar (pastille + texte)
    expect(screen.getByText(/Erreur PTY Rust/i)).toBeInTheDocument();
  });

  it("envoie la saisie clavier au PTY Rust (write_pty_input)", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      onDataCallback?.("p");
      onDataCallback?.("w");
      onDataCallback?.("d");
      onDataCallback?.("\r");
    });

    // Chaque caractère est écrit dans le PTY Rust
    expect(tauriInvoke).toHaveBeenCalledWith(
      "write_pty_input",
      expect.objectContaining({ sessionId: "session-1", data: "p" })
    );
    expect(tauriInvoke).toHaveBeenCalledWith(
      "write_pty_input",
      expect.objectContaining({ data: "\r" })
    );
    // La commande 'pwd' est mémorisée dans l'historique local
    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("pwd");
  });

  it("signale une erreur si write_pty_input échoue", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("pty fermé"));
    await act(async () => {
      onDataCallback?.("x");
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Échec d'écriture PTY/)).toBeInTheDocument();
    });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("redimensionne la session PTY Rust (resize_pty_session)", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      resizeObserverCallback?.([], {} as ResizeObserver);
      resizeObserverCallback?.([], {} as ResizeObserver); // debounce : clearTimeout
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });

    expect(lastFitAddon?.fit).toHaveBeenCalled();
    expect(tauriInvoke).toHaveBeenCalledWith(
      "resize_pty_session",
      expect.objectContaining({ sessionId: "session-1", cols: 80, rows: 24 })
    );
  });

  it("signale une erreur si resize_pty_session échoue", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await new Promise((r) => setTimeout(r, 50));
    });

    (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("resize refusé"));
    await act(async () => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PTY] Échec resize session session-1"),
      expect.anything()
    );
    errSpy.mockRestore();
  });

  it("ferme la session PTY Rust au démontage et se désinscrit", async () => {
    const { unmount } = render(<TerminalView {...defaultProps} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(ptyListener).not.toBeNull();

    await act(async () => {
      unmount();
    });

    expect(tauriInvoke).toHaveBeenCalledWith(
      "close_pty_session",
      expect.objectContaining({ sessionId: "session-1" })
    );
    // L'écouteur Tauri est désinscrit au démontage
    expect(ptyListener).toBeNull();
  });

  it("signale une erreur si close_pty_session échoue au démontage", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<TerminalView {...defaultProps} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    (tauriInvoke as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fermeture refusée"));
    await act(async () => {
      unmount();
    });

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PTY] Échec fermeture session session-1"),
      expect.anything()
    );
    errSpy.mockRestore();
  });
});
