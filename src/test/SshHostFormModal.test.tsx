import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SshHostFormModal } from "../components/SshHostFormModal";
import { SshHost } from "../types";

describe("SshHostFormModal", () => {
  const mockHost: SshHost = {
    id: "ssh_123",
    name: "Prod Web",
    host: "192.168.1.100",
    port: 2222,
    username: "deploy",
    authType: "key",
    privateKeyPath: "~/.ssh/id_ed25519",
    category: "Production",
    color: "#10b981",
    description: "Serveur web",
    tunnels: ["8080:localhost:80"],
    quickCommands: [{ id: "qc_1", name: "CPU", cmd: "top -b" }],
  };

  const defaultProps = {
    editingHost: null as SshHost | null,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le formulaire en mode création avec les valeurs par défaut", () => {
    render(<SshHostFormModal {...defaultProps} />);
    expect(screen.getByText("Nouveau Serveur SSH")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ex: Production Web Server")).toHaveValue("");
    expect(screen.getByPlaceholderText("root")).toHaveValue("root");
    expect(screen.getByPlaceholderText("~/.ssh/id_rsa")).toBeInTheDocument();
    expect(screen.getByText("Clé SSH (id_rsa / id_ed25519)")).toBeInTheDocument();
    expect(screen.getByText(/Aucun tunnel de port configuré/i)).toBeInTheDocument();
    expect(screen.getByText(/Aucune commande rapide configurée/i)).toBeInTheDocument();
  });

  it("pré-remplit le formulaire en mode édition", () => {
    render(<SshHostFormModal {...defaultProps} editingHost={mockHost} />);
    expect(screen.getByText("Éditer l'Hôte SSH")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ex: Production Web Server")).toHaveValue("Prod Web");
    expect(screen.getByPlaceholderText("192.168.1.100 ou mydomain.com")).toHaveValue("192.168.1.100");
    expect(screen.getByPlaceholderText("22")).toHaveValue(2222);
    expect(screen.getByPlaceholderText("root")).toHaveValue("deploy");
    // Tunnel et commande rapide pré-existants (rendus avec préfixe "-L ")
    expect(screen.getByText(/-L 8080:localhost:80/)).toBeInTheDocument();
    expect(screen.getByText(/CPU :/i)).toBeInTheDocument();
    expect(screen.getByText("top -b")).toBeInTheDocument();
  });

  it("soumet le formulaire et appelle onSave avec les données saisies", () => {
    render(<SshHostFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("ex: Production Web Server"), {
      target: { value: "Serveur Test" },
    });
    fireEvent.change(screen.getByPlaceholderText("192.168.1.100 ou mydomain.com"), {
      target: { value: "test.example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("root"), { target: { value: "toto" } });

    fireEvent.click(screen.getByText("Enregistrer l'Hôte"));

    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    const saved = defaultProps.onSave.mock.calls[0][0] as SshHost;
    expect(saved.name).toBe("Serveur Test");
    expect(saved.host).toBe("test.example.com");
    expect(saved.username).toBe("toto");
    expect(saved.port).toBe(22);
    expect(saved.authType).toBe("key");
    expect(saved.privateKeyPath).toBe("~/.ssh/id_rsa");
    expect(saved.id).toMatch(/^ssh_/);
  });

  it("ne soumet pas si les champs obligatoires sont vides", () => {
    render(<SshHostFormModal {...defaultProps} />);
    // Submit direct sur le formulaire (contourne la validation HTML5)
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("bascule en mode mot de passe : le champ clé disparaît et privateKeyPath est omis", () => {
    render(<SshHostFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Mot de passe"));
    expect(screen.queryByPlaceholderText("~/.ssh/id_rsa")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("ex: Production Web Server"), {
      target: { value: "Srv" },
    });
    fireEvent.change(screen.getByPlaceholderText("192.168.1.100 ou mydomain.com"), {
      target: { value: "srv.test" },
    });
    fireEvent.click(screen.getByText("Enregistrer l'Hôte"));

    const saved = defaultProps.onSave.mock.calls[0][0] as SshHost;
    expect(saved.authType).toBe("password");
    expect(saved.privateKeyPath).toBeUndefined();
  });

  it("ajoute et retire un tunnel de port", () => {
    render(<SshHostFormModal {...defaultProps} />);
    const tunnelInput = screen.getByPlaceholderText(/Ex: 8080:localhost:80/i);
    fireEvent.change(tunnelInput, { target: { value: "9090:localhost:90" } });
    // Le bouton du bloc tunnels s'appelle "Ajouter" (le "+" est pour les commandes)
    fireEvent.click(screen.getByText("Ajouter"));

    expect(screen.getByText(/-L 9090:localhost:90/)).toBeInTheDocument();

    // Retrait du tunnel
    const removeButtons = screen
      .getByText(/-L 9090:localhost:90/)
      .closest("div")!
      .querySelectorAll("button");
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText(/-L 9090:localhost:90/)).not.toBeInTheDocument();
  });

  it("ajoute et retire une commande rapide", () => {
    render(<SshHostFormModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText("Libellé (ex: CPU)"), {
      target: { value: "RAM" },
    });
    fireEvent.change(screen.getByPlaceholderText("Commande (ex: top -b)"), {
      target: { value: "free -h" },
    });
    // Le bouton "+" du bloc commandes rapides
    fireEvent.click(screen.getByRole("button", { name: "+" }));

    expect(screen.getByText(/RAM :/i)).toBeInTheDocument();
    expect(screen.getByText("free -h")).toBeInTheDocument();

    // Retrait : le ✕ de la commande (2e ✕ du document, après celui du header)
    fireEvent.click(screen.getAllByText("✕")[1]);
    expect(screen.queryByText(/RAM :/i)).not.toBeInTheDocument();
  });

  it("ferme le modal via le bouton ✕", () => {
    render(<SshHostFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText("✕"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("ferme le modal via le bouton Annuler", () => {
    render(<SshHostFormModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Annuler"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
