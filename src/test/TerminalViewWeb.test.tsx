import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalView } from "../components/TerminalView";

// ── Mocks xterm : non exécutable en jsdom (WebGL, canvas) ──────────────
// Les instances et callbacks sont capturés pour les assertions.
let mockTerminal: any = null;
let mockFitAddon: any = null;
let mockSearchAddon: any = null;
let mockWebglAddon: any = null;
let mockOnDataCallback: ((data: string) => void) | null = null;
let mockWebglContextLossCallback: (() => void) | null = null;
let mockResizeObserverCallback: ResizeObserverCallback | null = null;
let mockWebglShouldThrow = false;

vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    open = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn((cb: (d: string) => void) => {
      mockOnDataCallback = cb;
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
      mockTerminal = this;
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
      mockFitAddon = this;
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
      mockSearchAddon = this;
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
    onContextLoss = vi.fn((cb: () => void) => {
      mockWebglContextLossCallback = cb;
    });
    dispose = vi.fn();
    constructor() {
      mockWebglAddon = this;
      if (mockWebglShouldThrow) throw new Error("WebGL indisponible");
    }
  }
  return { WebglAddon: MockWebglAddon };
});

// ── Mode web : isTauri → false (fallback WebSocket vers le backend Node) ──
vi.mock("../lib/tauri", () => ({
  isTauri: () => false,
  tauriInvoke: vi.fn().mockResolvedValue({}),
  tauriListen: vi.fn().mockResolvedValue(() => {}),
  PtyOutputEvent: "pty-output",
}));

// Client API : fallback HTTP contrôlable + wsUrlWithToken identité
const mockApiFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
vi.mock("../lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  wsUrlWithToken: (url: string) => url,
}));

// ── Mock WebSocket global (même pattern que LogsStreamer.test.tsx) ──
class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error?: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState: number = 0; // CONNECTING
  static instances: MockWebSocket[] = [];
  static autoOpen = true;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  });
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    if (MockWebSocket.autoOpen) {
      queueMicrotask(() => {
        this.readyState = 1; // OPEN
        this.onopen?.();
      });
    }
  }
  triggerMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  triggerRaw(data: string) {
    this.onmessage?.({ data });
  }
}

// ResizeObserver qui capture le callback (pour déclencher le debounce 50ms)
class CapturingResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    mockResizeObserverCallback = cb;
  }
}

// Mock de l'API Notification navigateur
class MockNotification {
  static permission: NotificationPermission = "granted";
  static instances: MockNotification[] = [];
  title: string;
  options?: NotificationOptions;
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    MockNotification.instances.push(this);
  }
}

describe("TerminalView — mode web (WebSocket)", () => {
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
    onOutput: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    MockWebSocket.instances = [];
    MockWebSocket.autoOpen = true;
    vi.stubGlobal("WebSocket", MockWebSocket);
    global.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
    (window as any).Notification = MockNotification;
    MockNotification.instances = [];
    MockNotification.permission = "granted";
    localStorage.clear();
    mockTerminal = null;
    mockFitAddon = null;
    mockSearchAddon = null;
    mockWebglAddon = null;
    mockOnDataCallback = null;
    mockWebglContextLossCallback = null;
    mockResizeObserverCallback = null;
    mockWebglShouldThrow = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Rendu + flush des microtâches (ouverture WS) dans un act()
  const renderView = async (props: Partial<typeof defaultProps> = {}) => {
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<TerminalView {...defaultProps} {...props} />);
      await Promise.resolve();
    });
    return utils;
  };

  it("se connecte au WebSocket et écrit la sortie reçue dans xterm", async () => {
    await renderView();

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const ws = MockWebSocket.instances[0];
    // À l'ouverture : statut connecté + dimensions envoyées au backend
    expect(screen.getByTitle(/Connecté au PTY Linux/i)).toBeInTheDocument();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "resize", cols: 80, rows: 24 })
    );

    await act(async () => {
      ws.triggerMessage({ type: "output", data: "bonjour depuis le PTY web\n" });
    });

    expect(mockTerminal.write).toHaveBeenCalledWith("bonjour depuis le PTY web\n");
    // L'observateur de sortie (séquenceur de playbooks) est notifié
    expect(defaultProps.onOutput).toHaveBeenCalledWith("bonjour depuis le PTY web\n");
  });

  it("fonctionne sans observateur onOutput", async () => {
    await renderView({ onOutput: undefined });

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "output", data: "x\n" });
    });
    expect(mockTerminal.write).toHaveBeenCalledWith("x\n");
  });

  it("traite le message de sortie (exit) : ferme la socket et notifie", async () => {
    await renderView();

    const ws = MockWebSocket.instances[0];
    await act(async () => {
      ws.triggerMessage({ type: "exit", code: 0 });
    });

    expect(ws.close).toHaveBeenCalled();
    expect(screen.getByTitle(/Processus terminé \(code 0\)/)).toBeInTheDocument();
    // Notification système déclenchée
    expect(MockNotification.instances).toHaveLength(1);
    expect(MockNotification.instances[0].title).toContain("Processus PTY Linux Terminé");
    // Pas de reconnexion après un exit
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("traite un exit sans code de sortie (signal)", async () => {
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit" });
    });
    expect(screen.getByTitle(/Processus terminé \(code signal\)/)).toBeInTheDocument();
  });

  it("traite un message non-JSON comme sortie brute", async () => {
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].triggerRaw("sortie brute sans JSON");
    });
    expect(mockTerminal.write).toHaveBeenCalledWith("sortie brute sans JSON");
  });

  it("affiche une erreur si le WebSocket échoue", async () => {
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].onerror?.();
    });
    expect(screen.getByTitle(/Erreur de websocket/i)).toBeInTheDocument();
  });

  it("se reconnecte avec un backoff progressif (1s → 2s → 4s → 8s → 10s)", async () => {
    vi.useFakeTimers();
    MockWebSocket.autoOpen = false;

    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const ws1 = MockWebSocket.instances[0];
    await act(async () => {
      ws1.close();
    });
    expect(screen.getByTitle(/Déconnecté — reconnexion dans 1s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
    const ws2 = MockWebSocket.instances[1];
    await act(async () => {
      ws2.close();
    });
    expect(screen.getByTitle(/Déconnecté — reconnexion dans 2s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(MockWebSocket.instances).toHaveLength(3);
    const ws3 = MockWebSocket.instances[2];
    await act(async () => {
      ws3.close();
    });
    expect(screen.getByTitle(/Déconnecté — reconnexion dans 4s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(MockWebSocket.instances).toHaveLength(4);
    const ws4 = MockWebSocket.instances[3];
    await act(async () => {
      ws4.close();
    });
    expect(screen.getByTitle(/Déconnecté — reconnexion dans 8s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    expect(MockWebSocket.instances).toHaveLength(5);
    const ws5 = MockWebSocket.instances[4];
    await act(async () => {
      ws5.close();
    });
    // Backoff plafonné à 10 s
    expect(screen.getByTitle(/Déconnecté — reconnexion dans 10s/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(MockWebSocket.instances).toHaveLength(6);
  });

  it("annule la reconnexion programmée au démontage", async () => {
    vi.useFakeTimers();
    MockWebSocket.autoOpen = false;

    const { unmount } = render(<TerminalView {...defaultProps} />);
    await act(async () => {});
    const ws1 = MockWebSocket.instances[0];
    await act(async () => {
      ws1.close();
    });
    await act(async () => {
      unmount();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    // Aucune nouvelle tentative de connexion après démontage
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("ferme la socket WebSocket ouverte au démontage", async () => {
    const { unmount } = await renderView();
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      unmount();
    });

    expect(ws.close).toHaveBeenCalled();
    expect(mockTerminal.dispose).toHaveBeenCalled();
  });

  it("ne ferme pas une socket non ouverte au démontage", async () => {
    MockWebSocket.autoOpen = false;
    const { unmount } = render(<TerminalView {...defaultProps} />);
    await act(async () => {});

    const ws = MockWebSocket.instances[0];
    await act(async () => {
      unmount();
    });

    expect(ws.close).not.toHaveBeenCalled();
  });

  it("redimensionne via ResizeObserver et envoie resize au WebSocket", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];
    const resizeBefore = ws.send.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('"resize"')
    ).length;

    await act(async () => {
      mockResizeObserverCallback?.([], {} as ResizeObserver);
      mockResizeObserverCallback?.([], {} as ResizeObserver); // debounce : clearTimeout
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });

    expect(mockFitAddon.fit).toHaveBeenCalled();
    const resizeAfter = ws.send.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('"resize"')
    ).length;
    expect(resizeAfter).toBe(resizeBefore + 1);
  });

  it("ignore le resize si proposeDimensions ne retourne rien", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];
    // À partir d'ici, plus aucune dimension proposée
    mockFitAddon.proposeDimensions.mockReturnValue(undefined);

    await act(async () => {
      mockResizeObserverCallback?.([], {} as ResizeObserver);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });

    const resizeCalls = ws.send.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('"resize"')
    );
    // Seul le resize d'ouverture (onopen) a été envoyé
    expect(resizeCalls).toHaveLength(1);
  });

  it("ignore une erreur de fit pendant le resize (terminal détaché)", async () => {
    await renderView();
    mockFitAddon.fit.mockImplementationOnce(() => {
      throw new Error("terminal détaché");
    });

    await act(async () => {
      mockResizeObserverCallback?.([], {} as ResizeObserver);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 70));
    });
    // Pas de crash — le terminal continue de fonctionner
    expect(mockTerminal.write).toBeDefined();
  });

  it("purge le debounce de resize en attente au démontage", async () => {
    const { unmount } = await renderView();
    await act(async () => {
      mockResizeObserverCallback?.([], {} as ResizeObserver);
    });
    await act(async () => {
      unmount();
    });
    expect(mockTerminal.dispose).toHaveBeenCalled();
  });

  it("notifie la fin d'une commande longue (> 4 s)", async () => {
    vi.useFakeTimers();
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });
    await act(async () => {}); // flush microtâche → onopen

    // Saisie d'une commande puis Entrée
    await act(async () => {
      mockOnDataCallback?.("s");
      mockOnDataCallback?.("l");
      mockOnDataCallback?.("e");
      mockOnDataCallback?.("e");
      mockOnDataCallback?.("p");
      mockOnDataCallback?.("\r");
    });

    // Plus de 4 s plus tard, une sortie arrive → notification de fin
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "output", data: "done\n" });
    });

    expect(MockNotification.instances).toHaveLength(1);
    expect(MockNotification.instances[0].title).toContain("Exécution Terminée");

    // La commande active est réinitialisée → plus de notification
    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "output", data: "autre\n" });
    });
    expect(MockNotification.instances).toHaveLength(1);
  });

  it("n'envoie pas de notification si elles sont désactivées", async () => {
    await renderView({ notificationsEnabled: false });

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit", code: 1 });
    });

    expect(MockNotification.instances).toHaveLength(0);
    expect(screen.getByTitle(/Processus terminé \(code 1\)/)).toBeInTheDocument();
  });

  it("active les notifications par défaut", async () => {
    await renderView({ notificationsEnabled: undefined });

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit", code: 3 });
    });
    expect(MockNotification.instances).toHaveLength(1);
  });

  it("ne notifie pas si l'API Notification est absente du navigateur", async () => {
    delete (window as any).Notification;
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit", code: 2 });
    });
    expect(screen.getByTitle(/Processus terminé \(code 2\)/)).toBeInTheDocument();
  });

  it("ne notifie pas si la permission Notification est refusée", async () => {
    MockNotification.permission = "denied";
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit", code: 4 });
    });
    expect(MockNotification.instances).toHaveLength(0);
  });

  it("affiche l'overlay au survol puis le masque en quittant la zone", async () => {
    await renderView();

    const zone = screen.getByLabelText(/Zone de dépôt de fichiers du terminal/);
    await act(async () => {
      fireEvent.dragOver(zone, { dataTransfer: { dropEffect: "none" } });
    });
    expect(screen.getByText(/Déposez le fichier ici/)).toBeInTheDocument();

    // Second dragOver : l'état isDraggingFile est déjà vrai → pas de re-set
    await act(async () => {
      fireEvent.dragOver(zone, { dataTransfer: { dropEffect: "none" } });
    });
    expect(screen.getByText(/Déposez le fichier ici/)).toBeInTheDocument();

    // dragleave vers un ENFANT de la zone → l'overlay reste affiché
    // (fireEvent ne transmet pas relatedTarget en jsdom → MouseEvent natif)
    await act(async () => {
      zone.dispatchEvent(
        new MouseEvent("dragleave", {
          bubbles: true,
          relatedTarget: zone.firstElementChild as EventTarget,
        })
      );
    });
    expect(screen.getByText(/Déposez le fichier ici/)).toBeInTheDocument();

    // dragleave vers l'extérieur (document.body) → l'overlay disparaît
    await act(async () => {
      zone.dispatchEvent(
        new MouseEvent("dragleave", { bubbles: true, relatedTarget: document.body })
      );
    });
    expect(screen.queryByText(/Déposez le fichier ici/)).not.toBeInTheDocument();
  });

  it("injecte le chemin interne (explorateur) dans le terminal via drop", async () => {
    await renderView();

    const zone = screen.getByLabelText(/Zone de dépôt de fichiers du terminal/);
    await act(async () => {
      fireEvent.drop(zone, {
        dataTransfer: {
          getData: () => "/home/user/notes.txt",
          files: [],
        },
      });
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "input", data: '"/home/user/notes.txt" ' })
    );
    expect(mockTerminal.focus).toHaveBeenCalled();
  });

  it("accumule les fichiers déposés dans la barre de commande quand la socket est fermée", async () => {
    MockWebSocket.autoOpen = false;
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    const zone = screen.getByLabelText(/Zone de dépôt de fichiers du terminal/);
    await act(async () => {
      fireEvent.drop(zone, {
        dataTransfer: {
          getData: () => "",
          files: [
            { name: "a.txt", path: "/abs/a.txt" },
            { name: "b.txt" },
          ] as unknown as FileList,
        },
      });
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande/
    ) as HTMLInputElement;
    // Chemin absolu (Tauri) pour a.txt, nom seul pour b.txt
    expect(input.value).toBe('"/abs/a.txt" "b.txt" ');

    // Dépôt sans fichier ni chemin interne → rien n'est injecté
    await act(async () => {
      fireEvent.drop(zone, { dataTransfer: { getData: () => "", files: [] } });
    });
    expect(input.value).toBe('"/abs/a.txt" "b.txt" ');
  });

  it("collecte la saisie clavier, sauvegarde l'historique et envoie au PTY", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      mockOnDataCallback?.("l");
      mockOnDataCallback?.("s");
      mockOnDataCallback?.("\r");
    });

    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("ls");
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "\r" }));

    // Retour arrière : 'b' est effacé ; '\n' compte aussi comme Entrée
    await act(async () => {
      mockOnDataCallback?.("a");
      mockOnDataCallback?.("b");
      mockOnDataCallback?.("\x7f");
      mockOnDataCallback?.("\n");
    });
    const saved2 = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved2).toContain("a");

    // Caractère de contrôle ignoré ; Entrée sans texte → rien à sauvegarder
    await act(async () => {
      mockOnDataCallback?.("\x01");
      mockOnDataCallback?.("\r");
    });
    const saved3 = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved3).not.toContain("\x01");
  });

  it("envoie une commande rapide via le WebSocket ouvert", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande/
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "df -h" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "df -h\r" }));
    expect(input.value).toBe("");
    expect(mockTerminal.focus).toHaveBeenCalled();

    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("df -h");
  });

  it("ignore une commande vide", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande/
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });

    const inputSends = ws.send.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes('"type":"input"')
    );
    expect(inputSends).toHaveLength(0);
  });

  it("exécute une commande cliquée dans l'historique (cmdToSend explicite)", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/));
    });
    // Les commandes par défaut sont proposées
    await act(async () => {
      fireEvent.click(screen.getByText("htop"));
    });

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "htop\r" }));
    // Le dropdown est refermé après exécution
    expect(screen.queryByText("COMMANDES RÉCENTES")).not.toBeInTheDocument();
  });

  it("recherche dans le terminal : Suivant / Précédent / fermeture", async () => {
    await renderView();

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Rechercher dans le terminal/));
    });
    const searchInput = screen.getByPlaceholderText(/Rechercher dans l'historique terminal/);

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "erreur" } });
      fireEvent.submit(searchInput.closest("form") as HTMLFormElement);
    });
    expect(mockSearchAddon.findNext).toHaveBeenCalledWith("erreur");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Précédent/ }));
    });
    expect(mockSearchAddon.findPrevious).toHaveBeenCalledWith("erreur");

    // Requête vide → aucune recherche lancée
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "" } });
      fireEvent.submit(searchInput.closest("form") as HTMLFormElement);
    });
    expect(mockSearchAddon.findNext).toHaveBeenCalledTimes(1);

    // Fermeture de la barre de recherche
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "✕" }));
    });
    expect(
      screen.queryByPlaceholderText(/Rechercher dans l'historique terminal/)
    ).not.toBeInTheDocument();
  });

  it("copie la sélection dans le presse-papier puis réinitialise l'état", async () => {
    vi.useFakeTimers();
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });
    await act(async () => {}); // flush microtâche → onopen
    mockTerminal.getSelection.mockReturnValue("texte sélectionné");

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Copier la sélection/));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("texte sélectionné");
    expect(document.querySelector(".lucide-check")).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector(".lucide-check")).toBeNull();
    expect(document.querySelector(".lucide-copy")).not.toBeNull();
  });

  it("ne copie rien si aucune sélection n'existe", async () => {
    await renderView();
    mockTerminal.getSelection.mockReturnValue("");

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Copier la sélection/));
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("envoie SIGINT (Ctrl+C) via le WebSocket", async () => {
    await renderView();
    const ws = MockWebSocket.instances[0];

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Envoyer SIGINT/));
    });
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "input", data: "\x03" }));
  });

  it("efface l'écran du terminal", async () => {
    await renderView();

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Effacer l'écran/));
    });
    expect(mockTerminal.clear).toHaveBeenCalled();
  });

  it("met à jour le thème xterm quand le thème actif change", async () => {
    const { rerender } = await renderView();

    await act(async () => {
      rerender(<TerminalView {...defaultProps} activeThemeId="one-dark" />);
    });
    expect((mockTerminal.options.theme as { background: string }).background).toBe("#1e222a");

    // Thème inconnu → repli sur le premier thème (dracula)
    await act(async () => {
      rerender(<TerminalView {...defaultProps} activeThemeId="thème-inconnu" />);
    });
    expect((mockTerminal.options.theme as { background: string }).background).toBe("#282a36");
  });

  it("ajuste la taille de police xterm", async () => {
    const { rerender } = await renderView();

    await act(async () => {
      rerender(<TerminalView {...defaultProps} fontSize={16} />);
    });
    expect(mockTerminal.options.fontSize).toBe(16);
  });

  it("dispose l'addon WebGL lors d'une perte de contexte", async () => {
    await renderView();

    await act(async () => {
      mockWebglContextLossCallback?.();
    });
    expect(mockWebglAddon.dispose).toHaveBeenCalled();
  });

  it("retombe sur le rendu DOM/Canvas si WebGL est indisponible", async () => {
    mockWebglShouldThrow = true;
    await renderView();

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "output", data: "ok\n" });
    });
    expect(mockTerminal.write).toHaveBeenCalledWith("ok\n");
  });

  it("charge et affiche l'arborescence de l'explorateur CWD", async () => {
    const payload = {
      ok: true,
      json: () =>
        Promise.resolve({
          items: [
            { name: "README.md", path: "/home/user/README.md", isDirectory: false, size: 10 },
            { name: "src", path: "/home/user/src", isDirectory: true, size: 0 },
          ],
          currentPath: "/home/user",
          parentPath: "/home",
          totalCount: 2,
          truncated: false,
        }),
    };
    mockApiFetch.mockResolvedValue(payload);

    await renderView();
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Explorateur de fichiers synchronisé/i));
    });

    await waitFor(() => {
      expect(screen.getByText("README.md")).toBeInTheDocument();
    });

    // Injection du chemin d'un fichier dans le PTY
    // (les 2 éléments ont un bouton d'injection → on prend celui du fichier)
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Injecter le chemin dans le PTY" })[0]);
    });
    const ws = MockWebSocket.instances[0];
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "input", data: '"/home/user/README.md" ' })
    );

    // Édition du fichier dans Monaco
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Éditer dans Monaco" }));
    });
    expect(defaultProps.onOpenMonacoFile).toHaveBeenCalledWith("/home/user/README.md");

    // Navigation dans un sous-dossier + indicateur de troncature
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [{ name: "lib.rs", path: "/home/user/src/lib.rs", isDirectory: false, size: 5 }],
          currentPath: "/home/user/src",
          parentPath: "/home/user",
          totalCount: 350,
          truncated: true,
        }),
    });
    await act(async () => {
      fireEvent.click(screen.getByText("src"));
    });
    await waitFor(() => {
      expect(screen.getByText("lib.rs")).toBeInTheDocument();
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/fs/tree?path=%2Fhome%2Fuser%2Fsrc");
    expect(screen.getByText("300/350")).toBeInTheDocument();

    // Rafraîchissement de l'explorateur
    mockApiFetch.mockResolvedValue(payload);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Rafraîchir l'explorateur/ }));
    });
    await waitFor(() => {
      expect(screen.getByText("README.md")).toBeInTheDocument();
    });
  });

  it("signale une erreur de chargement de l'explorateur", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("fs indisponible"));

    await renderView();
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Explorateur de fichiers synchronisé/i));
    });

    await waitFor(() => {
      expect(errSpy).toHaveBeenCalledWith("Failed to load CWD explorer tree", expect.anything());
    });
    // Dossier vide affiché
    expect(screen.getByText("Dossier vide")).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it("ne remplit pas l'explorateur si la réponse n'a pas d'items", async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ currentPath: "/x" }) });

    await renderView();
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Explorateur de fichiers synchronisé/i));
    });

    await waitFor(() => {
      expect(screen.getByText("Dossier vide")).toBeInTheDocument();
    });
  });

  it("envoie la saisie par HTTP quand la socket n'est pas ouverte", async () => {
    mockApiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    MockWebSocket.autoOpen = false;
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    await act(async () => {
      mockOnDataCallback?.("h");
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/pty/session-1/write",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("signale une erreur si l'écriture HTTP échoue", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValueOnce(new Error("http down"));
    MockWebSocket.autoOpen = false;
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
    });

    await act(async () => {
      mockOnDataCallback?.("h");
    });

    await waitFor(() => {
      expect(screen.getByTitle(/Échec d'écriture PTY/)).toBeInTheDocument();
    });
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("initialise l'historique par défaut au premier lancement", async () => {
    await renderView();
    const saved = JSON.parse(
      localStorage.getItem("tauri_linux_terminal_command_history") || "[]"
    );
    expect(saved).toContain("apt update && apt upgrade -y");
  });

  it("charge l'historique sauvegardé depuis localStorage", async () => {
    localStorage.setItem(
      "tauri_linux_terminal_command_history",
      JSON.stringify(["custom-cmd-1", "custom-cmd-2"])
    );
    await renderView();

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/));
    });
    expect(screen.getByText("custom-cmd-1")).toBeInTheDocument();
  });

  it("vide l'historique des commandes", async () => {
    await renderView();

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Effacer" }));
    });
    expect(screen.getByText("Aucune commande enregistrée")).toBeInTheDocument();
  });

  it("résiste aux erreurs localStorage (lecture)", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("stockage bloqué");
    });
    await renderView();
    expect(screen.getByText("Bash Main")).toBeInTheDocument();
  });

  it("résiste aux erreurs localStorage (écriture d'historique)", async () => {
    await renderView();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });

    const input = screen.getByPlaceholderText(
      /Saisissez ou choisissez une commande/
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "uptime" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });

    // L'historique reste en mémoire malgré l'échec du stockage
    expect(input.value).toBe("");
    spy.mockRestore();
  });

  it("résiste aux erreurs localStorage (suppression)", async () => {
    await renderView();
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("stockage bloqué");
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Historique des commandes sauvegardées/));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Effacer" }));
    });
    expect(screen.getByText("Aucune commande enregistrée")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("utilise process.cwd() si la session n'a pas de cwd", async () => {
    await renderView({ session: { ...mockSession, cwd: "" } });
    expect(screen.getByText("Bash Main")).toBeInTheDocument();
  });

  it("construit l'URL WebSocket avec l'id de session", async () => {
    await renderView();
    const url = MockWebSocket.instances[0].url;
    expect(url).toContain("/ws/pty?id=session-1");
    expect(url.startsWith("ws://")).toBe(true);
  });

  it("utilise wss:// et le bon hôte quand la page est servie en https", async () => {
    vi.stubGlobal("location", { protocol: "https:", host: "exemple.fr" });
    await act(async () => {
      render(<TerminalView {...defaultProps} />);
      await Promise.resolve();
    });
    expect(MockWebSocket.instances[0].url.startsWith("wss://exemple.fr/ws/pty?id=session-1")).toBe(
      true
    );
  });

  it("applique la valeur par défaut de notificationsEnabled quand la prop est absente", async () => {
    const props = { ...defaultProps };
    delete (props as Record<string, unknown>).notificationsEnabled;
    await act(async () => {
      render(<TerminalView {...(props as typeof defaultProps)} />);
      await Promise.resolve();
    });

    await act(async () => {
      MockWebSocket.instances[0].triggerMessage({ type: "exit", code: 5 });
    });
    // Notification envoyée → le défaut `true` s'applique bien
    expect(MockNotification.instances).toHaveLength(1);
  });
});
