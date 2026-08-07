import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SshHostManager } from '../components/SshHostManager';

describe('SshHostManager Component', () => {
  const mockOnExecuteInTerminal = vi.fn();
  const mockOnLaunchSshSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders SSH host manager header (liste vide au depart - plus d hotes fictifs)", () => {
    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
      />
    );

    expect(screen.getByText(/Carnet de Connexions SSH & Tunnels Distants/i)).toBeInTheDocument();
    // Aucun hôte fictif pré-rempli (les données inventées ont été supprimées)
    expect(screen.queryByText(/Serveur Prod West/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/VPS Staging/i)).not.toBeInTheDocument();
  });

  it('filters SSH hosts by search query', async () => {
    // Pré-remplit localStorage avec un hôte réel ajouté par l'utilisateur
    window.localStorage.setItem('terminal_ssh_hosts', JSON.stringify([
      { id: 'ssh-1', name: 'Raspberry Pi Cluster Local', host: 'raspberry.local', port: 22, username: 'pi', authType: 'key' },
      { id: 'ssh-2', name: 'Serveur Prod West', host: '192.168.1.100', port: 22, username: 'ubuntu', authType: 'key' }
    ]));

    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher nom, IP, user/i);
    fireEvent.change(searchInput, { target: { value: 'Raspberry' } });

    expect(await screen.findByText(/Raspberry Pi Cluster Local/i)).toBeInTheDocument();
    expect(screen.queryByText(/Serveur Prod West/i)).not.toBeInTheDocument();
  });

  it('triggers Connect SSH action when button is clicked', async () => {
    window.localStorage.setItem('terminal_ssh_hosts', JSON.stringify([
      { id: 'ssh-prod-1', name: 'Serveur Prod West', host: '192.168.1.100', port: 22, username: 'ubuntu', authType: 'key' }
    ]));

    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
      />
    );

    const connectButtons = await screen.findAllByRole('button', { name: /Connecter SSH/i });
    fireEvent.click(connectButtons[0]);

    expect(mockOnLaunchSshSession).toHaveBeenCalledTimes(1);
    expect(mockOnLaunchSshSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ssh-prod-1',
      username: 'ubuntu',
      host: '192.168.1.100'
    }));
  });

  it('opens create host modal and adds a new host', async () => {
    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
      />
    );

    const addButton = screen.getByRole('button', { name: /Ajouter un Hôte SSH/i });
    fireEvent.click(addButton);

    expect(screen.getByText(/Nouveau Serveur SSH/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/ex: Production Web Server/i);
    const hostInput = screen.getByPlaceholderText(/192.168.1.100 ou mydomain.com/i);

    fireEvent.change(nameInput, { target: { value: 'Test Server AWS' } });
    fireEvent.change(hostInput, { target: { value: '54.210.10.5' } });

    const submitBtn = screen.getByRole('button', { name: /Enregistrer l'Hôte/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Test Server AWS/i)).toBeInTheDocument();
    });
  });
});
