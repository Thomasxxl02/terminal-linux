import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SshTunnelFormModal } from "../components/SshTunnelFormModal";
import { SshHost, SshTunnel } from "../types";

const hosts: SshHost[] = [
  { id: "h1", name: "Serveur Prod", host: "192.168.1.10", port: 22, username: "root", description: "Prod", authType: "key" },
  { id: "h2", name: "Bastion", host: "10.0.0.1", port: 22, username: "admin", description: "", authType: "password" },
];

const editingTunnel: SshTunnel = {
  id: "t1",
  name: "Tunnel Postgres",
  hostId: "h1",
  type: "local",
  localPort: 5432,
  remoteHost: "db.internal",
  remotePort: 5432,
  serverAliveInterval: 60,
  exitOnFailure: true,
  status: "inactive",
  createdAt: Date.now(),
};

describe("SshTunnelFormModal", () => {
  it("affiche le mode création avec les hôtes disponibles", () => {
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Nouveau Tunnel SSH / Port Forwarding")).toBeInTheDocument();
    // Le select hôte contient les hôtes
    const hostSelect = screen.getAllByRole("combobox")[0];
    expect(hostSelect).toHaveValue("h1");
    expect(screen.getByText(/Serveur Prod/)).toBeInTheDocument();
  });

  it("affiche le mode édition avec les valeurs du tunnel", () => {
    render(
      <SshTunnelFormModal editingTunnel={editingTunnel} hosts={hosts} onSave={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.getByText("Éditer le Tunnel SSH")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex: Redirection PostgreSQL")).toHaveValue("Tunnel Postgres");
    // localPort et remotePort valent 5432 (2 champs)
    expect(screen.getAllByDisplayValue("5432").length).toBeGreaterThanOrEqual(2);
  });

  it("affiche un message si aucun hôte n'est configuré", () => {
    render(<SshTunnelFormModal editingTunnel={null} hosts={[]} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Aucun hôte configuré")).toBeInTheDocument();
  });

  it("soumet avec les valeurs saisies (type local)", () => {
    const onSave = vi.fn();
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Ex: Redirection PostgreSQL"), {
      target: { value: "Mon Tunnel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Mon Tunnel",
        hostId: "h1",
        type: "local",
        localPort: 8080,
        remoteHost: "localhost",
        remotePort: 80,
        exitOnFailure: true,
      })
    );
  });

  it("ne soumet pas sans nom", () => {
    const onSave = vi.fn();
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("bascule en mode SOCKS (-D) et force le port local 1080", () => {
    const onSave = vi.fn();
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={onSave} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /SOCKS/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Redirection PostgreSQL"), {
      target: { value: "Proxy SOCKS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    // En mode dynamic : remoteHost forcé 127.0.0.1, remotePort 0
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "dynamic",
        localPort: 1080,
        remoteHost: "127.0.0.1",
        remotePort: 0,
      })
    );
  });

  it("bascule en mode Distant (-R)", () => {
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Distant/ }));
    // Le champ "Hôte Distant Cible" reste visible
    expect(screen.getByText("Hôte Distant Cible (Remote Host)")).toBeInTheDocument();
  });

  it("ferme le modal via le bouton ✕", () => {
    const onClose = vi.fn();
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("annule via le bouton Annuler", () => {
    const onClose = vi.fn();
    render(<SshTunnelFormModal editingTunnel={null} hosts={hosts} onSave={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalled();
  });
});
