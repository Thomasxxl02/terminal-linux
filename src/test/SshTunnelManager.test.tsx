import { render, screen, fireEvent,} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SshTunnelManager } from "../components/SshTunnelManager";

describe("SshTunnelManager Component", () => {
  const mockOnExecuteInTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders SshTunnelManager headers (aucun tunnel fictif)", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    expect(screen.getByText(/Générateur & Testeur de Tunnels SSH \/ Reverse Proxy/i)).toBeInTheDocument();
    // Aucun tunnel fictif pré-rempli
    expect(screen.queryByText(/Redirection MySQL Staging/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reverse Proxy Dev Webserver/i)).not.toBeInTheDocument();
  });

  it("filters tunnels by searching", () => {
    // Pré-remplit avec des tunnels créés par l'utilisateur (données de test)
    window.localStorage.setItem('terminal_ssh_tunnels', JSON.stringify([
      { id: 't1', name: 'Redirection MySQL Staging', hostId: 'h1', type: 'local', localPort: 3306, remoteHost: 'db.internal', remotePort: 3306, status: 'active' },
      { id: 't2', name: 'Reverse Proxy Dev Webserver', hostId: 'h2', type: 'remote', localPort: 8080, remoteHost: 'localhost', remotePort: 80, status: 'inactive' }
    ]));

    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher nom, port local, hôte/i);
    fireEvent.change(searchInput, { target: { value: "MySQL" } });

    expect(screen.getByText(/Redirection MySQL Staging/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reverse Proxy Dev Webserver/i)).not.toBeInTheDocument();
  });

  it("triggers terminal command execution when Exécuter is clicked", async () => {
    // Le tunnel référence un hôte SSH (hostId) — il faut les deux pour la commande
    window.localStorage.setItem('terminal_ssh_hosts', JSON.stringify([
      { id: 'h1', name: 'Serveur Prod', host: '192.168.1.100', port: 22, username: 'ubuntu', authType: 'key' }
    ]));
    window.localStorage.setItem('terminal_ssh_tunnels', JSON.stringify([
      { id: 't1', name: 'Redirection MySQL Staging', hostId: 'h1', type: 'local', localPort: 3306, remoteHost: 'db.internal', remotePort: 3306, status: 'inactive' }
    ]));

    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const executeBtns = await screen.findAllByRole("button", { name: /Exécuter Terminal/i });
    fireEvent.click(executeBtns[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain("-L");
  });

  it("opens create tunnel modal", () => {
    render(
      <SshTunnelManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const createBtn = screen.getByRole("button", { name: /Créer un Tunnel SSH/i });
    fireEvent.click(createBtn);

    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();
  });
});
