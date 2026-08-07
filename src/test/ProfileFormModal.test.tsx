import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileFormModal } from "../components/ProfileFormModal";

describe("ProfileFormModal", () => {
  const setters = {
    setFormName: vi.fn(),
    setFormShell: vi.fn(),
    setFormCwd: vi.fn(),
    setFormColor: vi.fn(),
    setFormStartupScript: vi.fn(),
    setEnvPairs: vi.fn(),
  };
  const handleSaveProfile = vi.fn();
  const onClose = vi.fn();

  const renderModal = (overrides: Record<string, unknown> = {}) =>
    render(
      <ProfileFormModal
        editingProfile={null}
        formName=""
        formShell="/bin/bash"
        formCwd=""
        formColor="#0f0"
        formStartupScript=""
        envPairs={[{ key: "", value: "" }]}
        handleSaveProfile={handleSaveProfile}
        onClose={onClose}
        {...setters}
        {...overrides}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mode création : titre, champs vides et shells proposés", () => {
    renderModal();

    expect(screen.getByText("Créer un Nouveau Profil Shell")).toBeInTheDocument();
    expect(screen.getByText("Exécutable Shell")).toBeInTheDocument();
    expect(screen.getByText("fish")).toBeInTheDocument();
  });

  it("mode édition : titre et valeurs pré-remplies", () => {
    renderModal({
      editingProfile: { id: "p1", name: "Dev", shell: "/bin/zsh", cwd: "/tmp", color: "#0af" },
      formName: "Dev",
      formShell: "/bin/zsh",
      formCwd: "/tmp",
      formColor: "#0af",
      formStartupScript: "alias ll='ls -lh'",
      envPairs: [{ key: "NODE_ENV", value: "dev" }],
    });

    expect(screen.getByText("Éditer le Profil Shell")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dev")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/tmp")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alias ll='ls -lh'")).toBeInTheDocument();
    expect(screen.getByDisplayValue("NODE_ENV")).toBeInTheDocument();
  });

  it("soumet le formulaire et annule", () => {
    renderModal();
    fireEvent.submit(screen.getByText("Enregistrer").closest("form")!);
    expect(handleSaveProfile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Annuler"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ajoute une variable d'environnement", () => {
    renderModal();
    fireEvent.click(screen.getByText("Ajouter Var"));
    expect(setters.setEnvPairs).toHaveBeenCalledWith([
      { key: "", value: "" },
      { key: "", value: "" },
    ]);
  });

  it("retire une variable d'environnement", () => {
    renderModal({ envPairs: [{ key: "A", value: "1" }, { key: "B", value: "2" }] });
    fireEvent.click(screen.getByLabelText("Retirer la variable 2"));
    expect(setters.setEnvPairs).toHaveBeenCalledWith([{ key: "A", value: "1" }]);
  });

  it("propage les changements de champs aux setters", () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("Ex: Python Data Science"), {
      target: { value: "Mon Profil" },
    });
    expect(setters.setFormName).toHaveBeenCalledWith("Mon Profil");

    fireEvent.change(screen.getByPlaceholderText("Ex: /var/log ou /tmp"), {
      target: { value: "/home" },
    });
    expect(setters.setFormCwd).toHaveBeenCalledWith("/home");
  });

  it("propage le changement de shell, de couleur et de script de démarrage", () => {
    renderModal();

    // Select de l'exécutable shell
    fireEvent.change(screen.getByText("/bin/zsh").closest("select")!, {
      target: { value: "/bin/zsh" },
    });
    expect(setters.setFormShell).toHaveBeenCalledWith("/bin/zsh");

    // Champ texte de la couleur (le type=color est couvert par le même setter)
    fireEvent.change(screen.getByDisplayValue("#0f0"), {
      target: { value: "#ff0000" },
    });
    expect(setters.setFormColor).toHaveBeenCalledWith("#ff0000");

    // Script de démarrage
    fireEvent.change(screen.getByPlaceholderText(/alias ll=/), {
      target: { value: "alias g=git" },
    });
    expect(setters.setFormStartupScript).toHaveBeenCalledWith("alias g=git");
  });

  it("propage la saisie de la clé de variable d'environnement", () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText("KEY"), {
      target: { value: "NODE_ENV" },
    });
    expect(setters.setEnvPairs).toHaveBeenCalledWith([
      { key: "NODE_ENV", value: "" },
    ]);
  });

  it("propage la saisie de la valeur de variable d'environnement", () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText("VALUE"), {
      target: { value: "production" },
    });
    expect(setters.setEnvPairs).toHaveBeenCalledWith([
      { key: "", value: "production" },
    ]);
  });
});
