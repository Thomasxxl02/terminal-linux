import { render, screen, fireEvent,} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlaybookFormModal } from "../components/PlaybookFormModal";
import { Playbook } from "../types";

const editingPlaybook: Playbook = {
  id: "pb_1",
  name: "Pipeline Existant",
  description: "Description existante",
  category: "deploy",
  createdAt: Date.now(),
  steps: [
    { id: "s1", title: "Étape 1", command: "echo ok", stopOnError: true, delaySeconds: 1 },
  ],
};

describe("PlaybookFormModal", () => {
  it("affiche le mode création avec les valeurs par défaut", () => {
    render(<PlaybookFormModal editingPlaybook={null} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Créer un Nouveau Playbook")).toBeInTheDocument();
    // Les labels n'ont pas htmlFor → on cible les champs par placeholder/ordre
    const nameInput = screen.getByPlaceholderText("Ex: Nettoyage et Déploiement");
    expect(nameInput).toHaveValue("Nouveau Pipeline d'Automation");
    expect(screen.getByText(/Étapes du Pipeline \(1\)/)).toBeInTheDocument();
  });

  it("affiche le mode édition avec les valeurs du playbook", () => {
    render(
      <PlaybookFormModal editingPlaybook={editingPlaybook} onSave={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText("Éditer le Playbook")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Nettoyage et Déploiement")).toHaveValue("Pipeline Existant");
    // Le select catégorie est sélectionné sur "deploy" (vérif par option)
    const categorySelect = screen.getByRole("combobox");
    expect(categorySelect).toHaveValue("deploy");
    expect(screen.getByText(/Étapes du Pipeline \(1\)/)).toBeInTheDocument();
  });

  it("soumet le formulaire avec les données saisies", () => {
    const onSave = vi.fn();
    render(<PlaybookFormModal editingPlaybook={null} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Ex: Nettoyage et Déploiement"), {
      target: { value: "Mon Pipeline" },
    });
    fireEvent.change(screen.getByPlaceholderText("Notes sur ce pipeline d'automation..."), {
      target: { value: "Ma description" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le Playbook/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Mon Pipeline",
        description: "Ma description",
        steps: expect.any(Array),
      })
    );
  });

  it("ne soumet pas si le nom est vide", () => {
    const onSave = vi.fn();
    render(<PlaybookFormModal editingPlaybook={null} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Ex: Nettoyage et Déploiement"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le Playbook/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("ajoute une étape via le bouton +", () => {
    render(<PlaybookFormModal editingPlaybook={null} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(/Étapes du Pipeline \(1\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter Étape brute/i }));
    expect(screen.getByText(/Étapes du Pipeline \(2\)/)).toBeInTheDocument();
  });

  it("ajoute une étape depuis le catalogue de snippets", () => {
    render(<PlaybookFormModal editingPlaybook={null} onSave={vi.fn()} onClose={vi.fn()} />);

    // Le catalogue affiche les titres de snippets (div cliquable, ex: Nettoyage Docker)
    const snippet = screen.getByText("Nettoyage Docker");
    fireEvent.click(snippet);

    expect(screen.getByText(/Étapes du Pipeline \(2\)/)).toBeInTheDocument();
  });

  it("ferme le modal via le bouton de fermeture", () => {
    const onClose = vi.fn();
    render(<PlaybookFormModal editingPlaybook={null} onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("ne soumet pas si le nom est vide et change la catégorie", () => {
    const onSave = vi.fn();
    render(<PlaybookFormModal editingPlaybook={null} onSave={onSave} onClose={vi.fn()} />);

    // Nom vide → le submit est ignoré (aucun appel onSave)
    fireEvent.change(screen.getByPlaceholderText("Ex: Nettoyage et Déploiement"), {
      target: { value: "   " },
    });
    fireEvent.submit(screen.getByText("Enregistrer le Playbook").closest("form")!);
    expect(onSave).not.toHaveBeenCalled();

    // Changement de catégorie
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "security" },
    });
    expect(screen.getByRole("combobox")).toHaveValue("security");
  });

  it("modifie la pause et la commande d'une étape puis la retire", () => {
    render(
      <PlaybookFormModal editingPlaybook={editingPlaybook} onSave={vi.fn()} onClose={vi.fn()} />
    );

    // Pause de l'étape 1 (type=number sans label htmlFor → rôle spinbutton)
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    expect(screen.getByRole("spinbutton")).toHaveValue(5);

    // Commande de l'étape
    fireEvent.change(screen.getByDisplayValue("echo ok"), {
      target: { value: "echo modifié" },
    });
    expect(screen.getByDisplayValue("echo modifié")).toBeInTheDocument();

    // Retrait de l'étape → plus aucune étape
    fireEvent.click(screen.getByLabelText("Retirer l'étape Étape 1"));
    expect(screen.getByText(/Étapes du Pipeline \(0\)/)).toBeInTheDocument();
  });
});
