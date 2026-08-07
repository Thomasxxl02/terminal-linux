import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SkillsHub } from "../components/SkillsHub";

describe("SkillsHub Component", () => {
  const mockOnExecuteInTerminal = vi.fn();

  it("renders skills list and default active skill details", () => {
    render(<SkillsHub onExecuteInTerminal={mockOnExecuteInTerminal} />);

    expect(screen.getByText(/Super-Compétences & Fonctions d'Automatisation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Scanner de Ports Réseau/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Analyseur de Logs Avancé/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Générateur de Charge CPU \/ IO/i)[0]).toBeInTheDocument();
  });

  it("updates parameters and triggers execution with resolved parameters", () => {
    render(<SkillsHub onExecuteInTerminal={mockOnExecuteInTerminal} />);

    // Change Host Target
    const hostInput = screen.getByLabelText(/Hôte ou IP Cible/i);
    fireEvent.change(hostInput, { target: { value: "8.8.8.8" } });

    // Change Ports Target
    const portsInput = screen.getByLabelText(/Ports à scanner/i);
    fireEvent.change(portsInput, { target: { value: "53,443" } });

    // Click execute
    const executeButton = screen.getByRole("button", { name: /Exécuter la Compétence/i });
    fireEvent.click(executeButton);

    expect(mockOnExecuteInTerminal).toHaveBeenCalled();
    const executedCommand = mockOnExecuteInTerminal.mock.calls[0][0];
    expect(executedCommand).toContain("8.8.8.8");
    expect(executedCommand).toContain("53,443");
  });

  it("can filter skills with search bar", () => {
    render(<SkillsHub onExecuteInTerminal={mockOnExecuteInTerminal} />);

    const searchInput = screen.getByPlaceholderText(/Filtrer les compétences/i);
    fireEvent.change(searchInput, { target: { value: "Docker" } });

    expect(screen.getByText(/Nettoyeur de Conteneurs Docker/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Scanner de Ports Réseau/i).length).toBe(1);
  });

  it("allows opening creator, adding a custom skill with variable inputs, and saving it", () => {
    render(<SkillsHub onExecuteInTerminal={mockOnExecuteInTerminal} />);

    // Open creator
    const creatorButton = screen.getByRole("button", { name: /Créer une Compétence/i });
    fireEvent.click(creatorButton);

    expect(screen.getByText(/Créateur de Compétence Personnalisée/i)).toBeInTheDocument();

    // Fill Title
    const titleInput = screen.getByPlaceholderText(/Déployeur Git Express/i);
    fireEvent.change(titleInput, { target: { value: "Git Pull Skill" } });

    // Fill Script Template
    const scriptInput = screen.getByPlaceholderText(/git checkout {{branch}} && git pull origin {{branch}} && npm run build/i);
    fireEvent.change(scriptInput, { target: { value: "git checkout {{branch}} && git pull" } });

    // Add form parameter
    const varIdInput = screen.getByPlaceholderText("e.g., branch");
    fireEvent.change(varIdInput, { target: { value: "branch" } });

    const labelInput = screen.getByPlaceholderText(/Branche Git/i);
    fireEvent.change(labelInput, { target: { value: "Target Branch" } });

    const addParamBtn = screen.getByRole("button", { name: /Ajouter cette variable au formulaire/i });
    fireEvent.click(addParamBtn);

    // Click Save Skill
    const saveButton = screen.getByRole("button", { name: /Enregistrer & Publier la Compétence/i });
    fireEvent.click(saveButton);

    // Creator is closed and new custom skill is selected
    expect(screen.queryByText(/Créateur de Compétence Personnalisée/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Git Pull Skill")[0]).toBeInTheDocument();

    // Verify custom parameter label is rendered on active skill form
    expect(screen.getByLabelText("Target Branch")).toBeInTheDocument();
  });

  it("remplit catégorie, description et paramètres détaillés du créateur", () => {
    render(<SkillsHub onExecuteInTerminal={mockOnExecuteInTerminal} />);

    fireEvent.click(screen.getByRole("button", { name: /Créer une Compétence/i }));

    // Catégorie
    fireEvent.change(screen.getByPlaceholderText("e.g., Git, DevOps, Nettoyage"), {
      target: { value: "DevOps" },
    });
    expect(screen.getByDisplayValue("DevOps")).toBeInTheDocument();

    // Description
    fireEvent.change(screen.getByPlaceholderText(/Expliquez ce que réalise/i), {
      target: { value: "Script de déploiement automatique" },
    });
    expect(screen.getByDisplayValue("Script de déploiement automatique")).toBeInTheDocument();

    // Renseigner les champs du paramètre AVANT de l'ajouter
    fireEvent.change(screen.getByPlaceholderText("e.g., branch"), {
      target: { value: "env" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Branche Git/i), {
      target: { value: "Environnement" },
    });
    // Type de champ → select (le champ Options n'apparaît que pour ce type)
    fireEvent.change(screen.getByText("Texte (Input)").closest("select")!, {
      target: { value: "select" },
    });
    expect(screen.getByPlaceholderText("main, dev, staging, master")).toBeInTheDocument();
    // Défaut
    fireEvent.change(screen.getByPlaceholderText("e.g., main"), {
      target: { value: "main" },
    });
    expect(screen.getByDisplayValue("main")).toBeInTheDocument();
    // Options
    fireEvent.change(screen.getByPlaceholderText("main, dev, staging, master"), {
      target: { value: "main, dev" },
    });
    expect(screen.getByDisplayValue("main, dev")).toBeInTheDocument();

    // Ajouter le paramètre → il apparaît dans la liste
    fireEvent.click(screen.getByRole("button", { name: /Ajouter cette variable au formulaire/i }));
    expect(screen.getByText(/Type : select/i)).toBeInTheDocument();

    // Retrait du paramètre → la ligne disparaît
    fireEvent.click(screen.getByLabelText("Retirer le paramètre env"));
    expect(screen.queryByText(/Type : select/i)).not.toBeInTheDocument();
  });
});
