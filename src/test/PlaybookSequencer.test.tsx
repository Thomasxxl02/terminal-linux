import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybookSequencer } from '../components/PlaybookSequencer';

describe('PlaybookSequencer Component', () => {
  const mockOnExecuteCommandInTerminal = vi.fn();
  const mockOnOpenTerminalView = vi.fn();

  const mockSessions = [
    { id: 'session-1', name: 'Bash Main', shell: 'bash', cwd: '/home/user', createdAt: Date.now() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders default playbooks and header', () => {
    render(
      <PlaybookSequencer
        sessions={mockSessions}
        activeSessionId="session-1"
        onExecuteCommandInTerminal={mockOnExecuteCommandInTerminal}
        onOpenTerminalView={mockOnOpenTerminalView}
      />
    );

    expect(screen.getByText(/Séquenceur de Playbooks & Automation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Pipeline Build/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Audit Sécurité/i).length).toBeGreaterThan(0);
  });

  it('allows selecting a playbook from the library', () => {
    render(
      <PlaybookSequencer
        sessions={mockSessions}
        activeSessionId="session-1"
        onExecuteCommandInTerminal={mockOnExecuteCommandInTerminal}
        onOpenTerminalView={mockOnOpenTerminalView}
      />
    );

    const playbookItem = screen.getAllByText(/Audit Sécurité/i)[0];
    fireEvent.click(playbookItem);

    expect(screen.getByText(/Inspection Top Processus/i)).toBeInTheDocument();
  });

  it('triggers pipeline execution when "LANCER LE PIPELINE" button is clicked', () => {
    render(
      <PlaybookSequencer
        sessions={mockSessions}
        activeSessionId="session-1"
        onExecuteCommandInTerminal={mockOnExecuteCommandInTerminal}
        onOpenTerminalView={mockOnOpenTerminalView}
      />
    );

    const launchButton = screen.getByRole('button', { name: /LANCER LE PIPELINE/i });
    fireEvent.click(launchButton);

    expect(mockOnOpenTerminalView).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteCommandInTerminal).toHaveBeenCalled();
  });
});
