import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TerminalToolbar } from "../components/TerminalToolbar";

describe("TerminalToolbar", () => {
  const makeProps = (overrides: Record<string, unknown> = {}) => ({
    session: { name: "Bash", shell: "/bin/bash" },
    isConnected: true,
    statusText: "",
    showExplorer: false,
    setShowExplorer: vi.fn(),
    showSearch: false,
    setShowSearch: vi.fn(),
    searchQuery: "",
    setSearchQuery: vi.fn(),
    handleSearchNext: vi.fn(),
    handleSearchPrev: vi.fn(),
    handleCopy: vi.fn(),
    copied: false,
    handleInterrupt: vi.fn(),
    handleClear: vi.fn(),
    fontSize: 14,
    setFontSize: vi.fn(),
    activeThemeId: "dracula",
    onThemeChange: vi.fn(),
    ...overrides,
  });

  it("change de thème via le sélecteur", () => {
    const props = makeProps();
    render(<TerminalToolbar {...props} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "nord" },
    });
    expect(props.onThemeChange).toHaveBeenCalledWith("nord");
  });

  it("affiche le statut de connexion et l'état déconnecté", () => {
    const props = makeProps({ isConnected: false, statusText: "Déconnecté — reconnexion dans 5s" });
    render(<TerminalToolbar {...props} />);

    expect(screen.getByText(/Déconnecté — reconnexion dans 5s/i)).toBeInTheDocument();
  });

  it("recherche : saisie, suivant, précédent et fermeture", () => {
    const props = makeProps({ showSearch: true });
    render(<TerminalToolbar {...props} />);

    fireEvent.change(screen.getByPlaceholderText(/Rechercher dans l'historique terminal/i), {
      target: { value: "apt" },
    });
    expect(props.setSearchQuery).toHaveBeenCalledWith("apt");

    fireEvent.click(screen.getByText("Suivant"));
    expect(props.handleSearchNext).toHaveBeenCalled();

    fireEvent.click(screen.getByText("✕"));
    expect(props.setShowSearch).toHaveBeenCalledWith(false);
  });

  it("déclenche copie, interruption et effacement", () => {
    const props = makeProps();
    render(<TerminalToolbar {...props} />);

    fireEvent.click(screen.getByTitle("Copier la sélection (ou Ctrl+C)"));
    expect(props.handleCopy).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("Envoyer SIGINT (Ctrl+C)"));
    expect(props.handleInterrupt).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle("Effacer l'écran"));
    expect(props.handleClear).toHaveBeenCalled();
  });

  it("ajuste la taille de la police", () => {
    const props = makeProps();
    render(<TerminalToolbar {...props} />);

    fireEvent.click(screen.getByTitle("Agrandir la police"));
    expect(props.setFontSize).toHaveBeenCalled();
  });
});
