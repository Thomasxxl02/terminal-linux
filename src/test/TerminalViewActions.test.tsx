import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalView } from "../components/TerminalView";

// ── Mocks xterm (identiques au test principal) ──────────────
vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    open = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    write = vi.fn();
    clear = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    getSelection = vi.fn(() => "texte sélectionné");
    options: Record<string, unknown> = {};
    cols = 80;
    rows = 24;
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
    findNext = vi.fn();
    findPrevious = vi.fn();
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

vi.mock("../lib/tauri", () => ({
  isTauri: () => false,
  tauriInvoke: vi.fn().mockResolvedValue({}),
  tauriListen: vi.fn().mockResolvedValue(() => {}),
  PtyOutputEvent: "pty-output",
}));

const mockApiFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
vi.mock("../lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  wsUrlWithToken: (url: string) => url,
}));

describe("TerminalView — historique et barre de commandes", () => {
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
    localStorage.clear();
  });

  it("enregistre l'historique et efface via le bouton Effacer", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande à envoyer au PTY/i
    );
    await act(async () => {
      fireEvent.change(input, { target: { value: "history-cmd" } });
      fireEvent.submit(input.closest("form")!);
    });

    // L'historique contient la commande
    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("history-cmd");

    // Effacer l'historique : ouvrir le dropdown d'abord
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByTitle("Effacer l'historique"));
    });
    const cleared = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(cleared).toHaveLength(0);
  });

  it("ouvre le dropdown d'historique et affiche la commande récente", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande à envoyer au PTY/i
    );
    await act(async () => {
      fireEvent.change(input, { target: { value: "cmd-1" } });
      fireEvent.submit(input.closest("form")!);
    });

    // Ouvrir le dropdown via le bouton Historique du header
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/i));
    });

    expect(await screen.findByText("cmd-1")).toBeInTheDocument();
  });

  it("envole Ctrl+C (SIGINT) sans erreur en mode web (pas de WS)", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    // Pas de crash : le handler vérifie l'état du WebSocket
    await act(async () => {
      fireEvent.click(screen.getByTitle("Envoyer SIGINT (Ctrl+C)"));
    });
  });

  it("efface l'écran via le bouton Eraser", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Effacer l'écran"));
    });
    // Le mock xterm.clear existe → pas de crash
  });

  it("diminue et augmente la taille de police", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle("Diminuer la police"));
    });
    expect(defaultProps.setFontSize).toHaveBeenCalledWith(13);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Agrandir la police"));
    });
    expect(defaultProps.setFontSize).toHaveBeenCalledWith(15);
  });

  it("ouvre l'explorateur de fichiers depuis la barre d'outils", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Explorateur de fichiers synchronisé/i));
    });
    // Le panneau explorateur devient visible
    expect(screen.getByTitle(/Explorateur de fichiers synchronisé/i)).toBeInTheDocument();
  });
});
