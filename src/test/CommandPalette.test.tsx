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
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe("CommandPalette", () => {
  it("ne rend rien si fermée", () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={vi.fn()} setActiveView={vi.fn()} sessions={sessions} activeSessionId={null} onSelectSession={vi.fn()} onCreateSession={vi.fn()} onExecuteMaintenance={vi.fn()} onThemeChange={vi.fn()} splitMode="single" setSplitMode={vi.fn()} onRequestNotifications={vi.fn()} notificationsEnabled={false} />);
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
});
