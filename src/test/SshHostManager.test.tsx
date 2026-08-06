import React from 'react';
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

  it('renders SSH host manager header and default hosts', () => {
    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
        sessions={[]}
        activeSessionId={null}
      />
    );

    expect(screen.getByText(/Carnet de Connexions SSH & Tunnels Distants/i)).toBeInTheDocument();
    expect(screen.getByText(/Serveur Prod West/i)).toBeInTheDocument();
    expect(screen.getByText(/VPS Staging/i)).toBeInTheDocument();
  });

  it('filters SSH hosts by search query', () => {
    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
        sessions={[]}
        activeSessionId={null}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Rechercher nom, IP, user/i);
    fireEvent.change(searchInput, { target: { value: 'Raspberry' } });

    expect(screen.getByText(/Raspberry Pi Cluster Local/i)).toBeInTheDocument();
    expect(screen.queryByText(/Serveur Prod West/i)).not.toBeInTheDocument();
  });

  it('triggers Connect SSH action when button is clicked', () => {
    render(
      <SshHostManager
        onExecuteInTerminal={mockOnExecuteInTerminal}
        onLaunchSshSession={mockOnLaunchSshSession}
        sessions={[]}
        activeSessionId={null}
      />
    );

    const connectButtons = screen.getAllByRole('button', { name: /Connecter SSH/i });
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
        sessions={[]}
        activeSessionId={null}
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
