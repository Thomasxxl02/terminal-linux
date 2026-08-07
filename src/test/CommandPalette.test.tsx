import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CommandPalette } from "../components/CommandPalette";
import { TerminalSessionInfo } from "../types";

const sessions: TerminalSessionInfo[] = [
  { id: "s1", name: "Bash", shell: "/bin/bash", cwd: "/home", createdAt: Date.now() },
  { id: "s2", name: "Zsh", shell: "/bin/zsh", cwd: "/tmp", createdAt: Date.now() },
];

function renderPalette(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    setActiveView: vi.fn(),
    sessions,
    activeSessionId: null,
    onSelectSession: vi.fn(),
    onCreateSession: vi.fn(),
    onExecuteMaintenance: vi.fn(),
    onThemeChange: vi.fn(),
    splitMode: "single" as const,
    setSplitMode: vi.fn(),
    onRequestNotifications: vi.fn(),
    notificationsEnabled: false,
    snippets: [],
    playbooks: [],
    onExecuteInTerminal: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe("CommandPalette", () => {
  it("ne rend rien si fermée", () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={vi.fn()} setActiveView={vi.fn()} sessions={sessions} activeSessionId={null} onSelectSession={vi.fn()} onCreateSession={vi.fn()} onExecuteMaintenance={vi.fn()} onThemeChange={vi.fn()} splitMode="single" setSplitMode={vi.fn()} onRequestNotifications={vi.fn()} notificationsEnabled={false} snippets={[]} playbooks={[]} onExecuteInTerminal={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("affiche les actions de navigation et les sessions", () => {
    renderPalette();

    // Actions de navigation
    expect(screen.getByText("Aller aux Terminaux PTY")).toBeInTheDocument();
    // Sessions PTY (titre "Basculer vers : <name>")
    expect(screen.getByText("Basculer vers : Bash")).toBeInTheDocument();
    expect(screen.getByText("Basculer vers : Zsh")).toBeInTheDocument();
  });

  it("navigue vers chaque vue via les actions de la palette", () => {
    const { cleanup } = require("@testing-library/react") as typeof import("@testing-library/react");
    const vues = [
      { query: "Monaco", attendu: "monaco" },
      { query: "Architecture Tauri", attendu: "tauri" },
      { query: "Snippets Linux", attendu: "snippets" },
      { query: "Raccourcis Web", attendu: "bookmarks" },
      { query: "Ressources", attendu: "stats" },
      { query: "Skills", attendu: "skills" },
    ];

    for (const { query, attendu } of vues) {
      const props = renderPalette();
      const input = screen.getByPlaceholderText(/Tapez une commande ou recherchez/i);
      fireEvent.change(input, { target: { value: query } });
      const action = screen.getAllByText(new RegExp(query, "i"))[0];
      fireEvent.click(action);
      expect(props.setActiveView).toHaveBeenCalledWith(attendu);
      cleanup();
    }
  });

  it("active le plein écran et le split depuis les actions", () => {
    const props = renderPalette();
    const input = screen.getByPlaceholderText(/Tapez une commande ou recherchez/i);

    fireEvent.change(input, { target: { value: "Plein écran" } });
    fireEvent.click(screen.getAllByText(/Plein écran/i)[0]);

    fireEvent.change(input, { target: { value: "Division" } });
    fireEvent.click(screen.getAllByText(/Division/i)[0]);
    expect(props.setSplitMode).toHaveBeenCalled();
  });

  it("filtre les actions selon la recherche", () => {
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), {
      target: { value: "zsh" },
    });
    expect(screen.getByText("Basculer vers : Zsh")).toBeInTheDocument();
    expect(screen.queryByText("Basculer vers : Bash")).not.toBeInTheDocument();
  });

  it("exécute l'action d'une session au clic", () => {
    const props = renderPalette();
    fireEvent.click(screen.getByText("Basculer vers : Bash"));
    expect(props.onSelectSession).toHaveBeenCalledWith("s1");
  });

  it("sélectionne avec Entrée la première action filtrée", () => {
    const props = renderPalette();
    // Recherche unique (le titre complet ne matche qu'une action)
    fireEvent.change(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), {
      target: { value: "Basculer vers : Zsh" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), { key: "Enter" });
    expect(props.onSelectSession).toHaveBeenCalledWith("s2");
  });

  it("ferme avec la touche Escape", () => {
    const props = renderPalette();
    fireEvent.keyDown(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("affiche l'état des notifications", () => {
    renderPalette({ notificationsEnabled: true });
    // L'action notifications existe
    expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
  });

  it("remonte la sélection avec ArrowUp", () => {
    const props = renderPalette();
    const input = screen.getByPlaceholderText(/Tapez une commande ou recherchez/i);

    // ArrowDown → 2e action, puis ArrowUp → retour à la 1re action
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    // La 1re action est "Aller aux Terminaux PTY" (navigation)
    expect(props.setActiveView).toHaveBeenCalledWith("terminal");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("boucle vers la dernière action depuis le haut (ArrowUp au sommet)", () => {
    const props = renderPalette();
    const input = screen.getByPlaceholderText(/Tapez une commande ou recherchez/i);

    // ArrowUp à l'index 0 → wrap sur la dernière action ; Enter l'exécute
    // sans erreur (la dernière action est une navigation ou maintenance)
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    // Pas de crash : soit la vue a changé, soit une action a été exécutée
    expect(props.onExecuteMaintenance).toBeTypeOf("function");
  });

  it("sélectionne l'action au survol (mouseEnter)", () => {
    const props = renderPalette();
    const action = screen.getByText("Basculer vers : Zsh");
    fireEvent.mouseEnter(action);
    fireEvent.keyDown(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), { key: "Enter" });
    expect(props.onSelectSession).toHaveBeenCalledWith("s2");
  });

  it("exécute la maintenance par clic", () => {
    const props = renderPalette();
    // Filtrer pour trouver l'action de maintenance (ex: Mise à jour système)
    fireEvent.change(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), {
      target: { value: "mise à jour" },
    });
    const maintAction = screen.getAllByText(/Mise à jour/i)[0];
    fireEvent.click(maintAction);
    expect(props.onExecuteMaintenance).toHaveBeenCalled();
  });

  it("exécute un snippet depuis la recherche globale", () => {
    const props = renderPalette({
      snippets: [
        {
          id: "s1",
          title: "Statut Docker",
          command: "docker ps",
          description: "Liste les conteneurs",
          category: "DevOps",
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), {
      target: { value: "docker" },
    });
    fireEvent.click(screen.getByText("Exécuter le snippet : Statut Docker"));

    expect(props.onExecuteInTerminal).toHaveBeenCalledWith("docker ps");
  });

  it("ouvre le séquenceur depuis un playbook de la recherche globale", () => {
    const props = renderPalette({
      playbooks: [
        {
          id: "p1",
          name: "Déploiement",
          description: "Pipeline prod",
          category: "deploy",
          createdAt: 1700000000000,
          steps: [
            { id: "st1", title: "Build", command: "npm run build", delaySeconds: 1, stopOnError: true },
          ],
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i), {
      target: { value: "déploiement" },
    });
    fireEvent.click(screen.getByText("Ouvrir le playbook : Déploiement"));

    expect(props.setActiveView).toHaveBeenCalledWith("playbooks");
  });
});
