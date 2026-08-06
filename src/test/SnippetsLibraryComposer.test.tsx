import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SnippetsLibrary } from "../components/SnippetsLibrary";

describe("SnippetsLibrary — séquenceur et créateur", () => {
  const mockExecute = vi.fn();

  beforeEach(() => {
    mockExecute.mockClear();
    localStorage.clear();
  });

  it("clique sur un snippet → l'ajoute au séquenceur", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    // Attendre le chargement async (useSecureStorage → localStorage)
    const firstSnippet = await screen.findByText(/Infos Système Détaillées/i);
    fireEvent.click(firstSnippet);

    // Le séquenceur affiche la commande + "Sélectionné"
    expect(await screen.findByText(/Sélectionné/i)).toBeInTheDocument();
    expect(screen.getByText(/Vider \(1\)/)).toBeInTheDocument();
  });

  it("assemble 2 commandes avec l'opérateur par défaut (&&)", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    const snip1 = await screen.findByText(/Infos Système Détaillées/i);
    fireEvent.click(snip1);
    const snip2 = await screen.findByText(/Conteneurs Docker Actifs/i);
    fireEvent.click(snip2);

    // L'aperçu contient les 2 commandes jointes par " && "
    await waitFor(() => {
      const previews = screen.getAllByText(/\$ .* && /);
      expect(previews.length).toBeGreaterThan(0);
    });
  });

  it("change l'opérateur de jonction en PIPE (|)", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    const snip1 = await screen.findByText(/Infos Système Détaillées/i);
    fireEvent.click(snip1);
    const snip2 = await screen.findByText(/Conteneurs Docker Actifs/i);
    fireEvent.click(snip2);

    fireEvent.click(screen.getByRole("button", { name: /PIPE \(\|\)/i }));
    await waitFor(() => {
      const previews = screen.getAllByText(/\$ .* \| /);
      expect(previews.length).toBeGreaterThan(0);
    });
  });

  it("injecte la séquence composée dans le terminal", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    const snip1 = await screen.findByText(/Infos Système Détaillées/i);
    fireEvent.click(snip1);
    const snip2 = await screen.findByText(/Conteneurs Docker Actifs/i);
    fireEvent.click(snip2);

    fireEvent.click(screen.getByRole("button", { name: /Injecter Séquence/i }));
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute.mock.calls[0][0]).toContain(" && ");
  });

  it("vide le séquenceur avec le bouton Vider", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    const snip = await screen.findByText(/Infos Système Détaillées/i);
    fireEvent.click(snip);
    expect(await screen.findByText(/Vider \(1\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Vider \(1\)/));
    expect(await screen.findByText(/Aucun snippet sélectionné/i)).toBeInTheDocument();
  });

  it("crée un snippet personnalisé et l'affiche", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    fireEvent.change(screen.getByPlaceholderText("ex: Nettoyage logs systemd"), {
      target: { value: "Mon Script" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: Docker, Git"), {
      target: { value: "Perso" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: journalctl --vacuum-time=7d"), {
      target: { value: "echo mon-script" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le Snippet/i }));

    expect(await screen.findByText("Mon Script")).toBeInTheDocument();
    // Le badge "Custom" apparaît sur la carte du snippet créé
    expect(screen.getAllByText(/Custom/).length).toBeGreaterThan(0);
  });

  it("supprime un snippet personnalisé", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    // Créer un snippet custom d'abord
    fireEvent.change(screen.getByPlaceholderText("ex: Nettoyage logs systemd"), {
      target: { value: "À Supprimer" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: journalctl --vacuum-time=7d"), {
      target: { value: "echo x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le Snippet/i }));
    expect(await screen.findByText("À Supprimer")).toBeInTheDocument();

    // Le bouton Supprimer (title) existe pour les customs
    const deleteBtn = screen.getAllByTitle("Supprimer");
    expect(deleteBtn.length).toBeGreaterThan(0);
    fireEvent.click(deleteBtn[0]);

    expect(screen.queryByText("À Supprimer")).not.toBeInTheDocument();
  });

  it("réinitialise les filtres quand aucun résultat", async () => {
    render(<SnippetsLibrary onExecuteInTerminal={mockExecute} />);

    fireEvent.change(screen.getByPlaceholderText(/Filtrer les snippets/i), {
      target: { value: "zzzz-inexistant" },
    });

    expect(await screen.findByText(/Aucun snippet trouvé/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Réinitialiser les filtres"));

    expect(await screen.findByText(/Infos Système Détaillées/i)).toBeInTheDocument();
  });
});
