import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SshHostManager } from "../components/SshHostManager";

const hosts = [
  { id: "ssh-1", name: "Raspberry Pi", host: "raspberry.local", port: 22, username: "pi", authType: "key", privateKeyPath: "/home/user/.ssh/id_rsa" },
  { id: "ssh-2", name: "Serveur Prod", host: "192.168.1.100", port: 22, username: "ubuntu", authType: "password" },
];

function renderManager(overrides: Partial<Parameters<typeof SshHostManager>[0]> = {}) {
  const props = {
    onExecuteInTerminal: vi.fn(),
    onLaunchSshSession: vi.fn(),
    sessions: [] as never[],
    activeSessionId: null,
    ...overrides,
  };
  render(<SshHostManager {...props} />);
  return props;
}

describe("SshHostManager — actions avancées", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("affiche les hôtes chargés depuis le stockage sécurisé", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    renderManager();

    expect(await screen.findByText("Raspberry Pi")).toBeInTheDocument();
    expect(screen.getByText("Serveur Prod")).toBeInTheDocument();
  });

  it("teste la connectivité via ping dans le terminal", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    const props = renderManager();

    await screen.findByText("Raspberry Pi");
    fireEvent.click(screen.getAllByTitle("Tester la connectivité (ping)")[0]);

    expect(props.onExecuteInTerminal).toHaveBeenCalledWith("ping -c 3 raspberry.local");
  });

  it("copie la commande SSH (avec clé privée) dans le presse-papiers", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: clipboardWrite } });
    renderManager();

    await screen.findByText("Raspberry Pi");
    fireEvent.click(screen.getAllByTitle(/Copier la commande de connexion SSH/i)[0]);

    expect(clipboardWrite).toHaveBeenCalled();
    const cmd = clipboardWrite.mock.calls[0][0] as string;
    expect(cmd).toContain("ssh");
    expect(cmd).toContain("-i");
    expect(cmd).toContain("pi@raspberry.local");
    vi.unstubAllGlobals();
  });

  it("supprime un hôte après confirmation", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    renderManager();

    await screen.findByText("Serveur Prod");
    fireEvent.click(screen.getAllByTitle("Supprimer de la liste locale")[1]);

    // Modal de confirmation (titre + bouton "Supprimer")
    expect((await screen.findAllByText(/Supprimer l'Hôte SSH/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    await waitFor(() => {
      expect(screen.queryByText("Serveur Prod")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Raspberry Pi")).toBeInTheDocument();
  });

  it("annule la suppression sans effet", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    renderManager();

    await screen.findByText("Serveur Prod");
    fireEvent.click(screen.getAllByTitle("Supprimer de la liste locale")[1]);
    expect((await screen.findAllByText(/Supprimer l'Hôte SSH/i)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Annuler/i }));
    expect(screen.getByText("Serveur Prod")).toBeInTheDocument();
  });

  it("modifie un hôte via le bouton d'édition", async () => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify(hosts));
    renderManager();

    await screen.findByText("Raspberry Pi");
    fireEvent.click(screen.getAllByTitle("Modifier la configuration")[0]);

    // Le modal d'édition s'ouvre avec le nom pré-rempli
    expect(await screen.findByText(/Éditer l'Hôte SSH/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Raspberry Pi")).toBeInTheDocument();
  });
});
