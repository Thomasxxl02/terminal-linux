import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TerminalView } from "../components/TerminalView";

// ── Mocks xterm : non exécutable en jsdom (WebGL, canvas) ──────────────
// L'instance créée est exposée pour les assertions de cleanup.
let lastTerminalInstance: { dispose: ReturnType<typeof vi.fn> } | null = null;

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

// Le module tauri : mode web par défaut dans les tests (isTauri → false)
vi.mock("../lib/tauri", () => ({
  isTauri: () => false,
  tauriInvoke: vi.fn().mockResolvedValue({}),
  tauriListen: vi.fn().mockResolvedValue(() => {}),
  PtyOutputEvent: "pty-output",
}));

// Mock du client API : fallback web (fetch) contrôlable
const mockApiFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
vi.mock("../lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  wsUrlWithToken: (url: string) => url,
}));

describe("TerminalView Component", () => {
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
  });

  it("renders the terminal with session name and shell badge", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    expect(screen.getByText("Bash Main")).toBeInTheDocument();
    expect(screen.getByText("bash")).toBeInTheDocument();
  });

  it("shows the command input bar with placeholder", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande à envoyer au PTY/i
    );
    expect(input).toBeInTheDocument();
  });

  it("submits a command via the quick command bar (saved to history)", async () => {
    // En mode web sans WebSocket ouvert, la commande est enregistrée dans
    // l'historique (localStorage) et le champ est vidé.
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande à envoyer au PTY/i
    );
    await act(async () => {
      fireEvent.change(input, { target: { value: "ls -la" } });
      fireEvent.submit(input.closest("form")!);
    });

    // Le champ est vidé après soumission
    expect((input as HTMLInputElement).value).toBe("");
    // La commande est dans l'historique localStorage
    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("ls -la");
  });

  it("toggles the synchronized CWD explorer button", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const explorerBtn = screen.getByTitle(/Explorateur de fichiers synchronisé/i);
    await act(async () => {
      fireEvent.click(explorerBtn);
    });

    // Le bouton affiche l'état actif
    expect(explorerBtn.className).toContain("emerald");
  });

  it("toggles the search bar", async () => {
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const searchBtn = screen.getByTitle(/Rechercher dans le terminal/i);
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(screen.getByPlaceholderText(/Rechercher dans l'historique terminal/i)).toBeInTheDocument();
  });

  it("cleans up the terminal on unmount", async () => {
    const { unmount } = render(<TerminalView {...defaultProps} />);

    await act(async () => {
      unmount();
    });

    // Le Terminal mock est disposé au démontage (aucune fuite de ressource)
    expect(lastTerminalInstance).not.toBeNull();
    expect(lastTerminalInstance?.dispose).toHaveBeenCalled();
  });
});
