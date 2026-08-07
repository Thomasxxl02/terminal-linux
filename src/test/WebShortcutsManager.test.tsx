import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebShortcutsManager } from "../components/WebShortcutsManager";

describe("WebShortcutsManager Component", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders default shortcuts correctly", () => {
    render(<WebShortcutsManager />);

    expect(screen.getByText("Raccourcis Web & Services")).toBeInTheDocument();
    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Documentation Rust")).toBeInTheDocument();
  });

  it("filters shortcuts using the search bar", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "Grafana" } });

    expect(screen.getByText("Grafana Local Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();
  });

  it("shows the empty state when the search has no result", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "zzz-inexistant" } });

    expect(screen.getByText("Aucun raccourci web trouvé")).toBeInTheDocument();
    expect(screen.getByText(/Aucun résultat pour la recherche/i)).toBeInTheDocument();
  });

  it("opens modal and creates a new web shortcut", () => {
    render(<WebShortcutsManager />);

    const newBtn = screen.getByText("Nouveau Raccourci");
    fireEvent.click(newBtn);

    expect(screen.getByText("Nouveau Raccourci Web")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    const urlInput = screen.getByPlaceholderText("https://github.com ou http://localhost:8080");

    fireEvent.change(titleInput, { target: { value: "Nginx Admin" } });
    fireEvent.change(urlInput, { target: { value: "http://localhost:8080" } });

    const submitBtn = screen.getByText("Créer le Raccourci");
    fireEvent.click(submitBtn);

    expect(screen.getByText("Nginx Admin")).toBeInTheDocument();
  });

  it("edits an existing shortcut via the edit button", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Éditer GitHub Repository/i }));

    // Le modal d'édition est pré-rempli
    expect(screen.getByText("Modifier le Raccourci Web")).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    expect(titleInput).toHaveValue("GitHub Repository");
  });

  it("deletes a shortcut after confirmation", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Supprimer Documentation Rust/i }));

    expect(screen.getByText("Supprimer le Raccourci Web ?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Supprimer"));

    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();
  });

  it("opens the embedded preview for shortcuts in embedded mode", () => {
    render(<WebShortcutsManager />);

    // Grafana Local Dashboard est en mode embedded : trouver le bouton
    // "Ouvrir" DANS sa carte
    const grafanaCard = screen.getByText("Grafana Local Dashboard").closest("div[class*='rounded']");
    expect(grafanaCard).not.toBeNull();
    const openButton = within(grafanaCard as HTMLElement).getByText("Ouvrir");
    fireEvent.click(openButton);

    // Le preview plein écran apparaît
    expect(screen.getByTitle("Fermer l'aperçu")).toBeInTheDocument();
    expect(screen.getByTitle("Rafraîchir")).toBeInTheDocument();
  });

  it("opens a shortcut in a new tab when in new_tab mode", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<WebShortcutsManager />);

    // GitHub Repository est en mode new_tab
    const openButtons = screen.getAllByText("Ouvrir");
    fireEvent.click(openButtons[0]);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://github.com",
      "_blank",
      "noopener,noreferrer"
    );
    windowOpenSpy.mockRestore();
  });

  it("triggers terminal execute command when testing cURL", () => {
    const handleExecuteInTerminal = vi.fn();
    render(<WebShortcutsManager onExecuteInTerminal={handleExecuteInTerminal} />);

    const curlButtons = screen.getAllByTitle("Envoyer commande cURL au terminal");
    if (curlButtons.length > 0) {
      fireEvent.click(curlButtons[0]);
      expect(handleExecuteInTerminal).toHaveBeenCalledWith(expect.stringContaining("curl -I"));
    }
  });
});
