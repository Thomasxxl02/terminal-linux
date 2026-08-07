import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalView } from "../components/TerminalView";

// ── Mocks xterm (mêmes classes constructibles que TerminalView.test.tsx) ──
let lastTerminalInstance: { write: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> } | null = null;

vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    open = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    write = vi.fn();
    clear = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
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
  }
  return { FitAddon: MockFitAddon };
});

vi.mock("@xterm/addon-search", () => {
  class MockSearchAddon {
    dispose = vi.fn();
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
});
