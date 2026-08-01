import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../components/Sidebar';

describe('Sidebar Component', () => {
  const mockSetActiveView = vi.fn();
  const mockOnSelectSession = vi.fn();
  const mockOnCreateSession = vi.fn();
  const mockOnCloseSession = vi.fn();

  const mockSessions = [
    { id: 'session-1', name: 'Bash Main', shell: 'bash', cwd: '/home/user', isActive: true, history: [] },
  ];

  it('renders sidebar brand and navigation tabs', () => {
    render(
      <Sidebar
        activeView="terminal"
        setActiveView={mockSetActiveView}
        sessions={mockSessions}
        activeSessionId="session-1"
        onSelectSession={mockOnSelectSession}
        onCreateSession={mockOnCreateSession}
        onCloseSession={mockOnCloseSession}
        systemStats={{
          platform: 'linux',
          release: '5.15.0',
          arch: 'x64',
          hostname: 'linux-pty',
          cpusCount: 4,
          totalMemBytes: 8589934592,
          freeMemBytes: 4294967296,
          memUsagePercent: 50,
          uptime: 3600,
          loadavg: [0.1, 0.2, 0.3],
        }}
      />
    );

    expect(screen.getByText(/Terminal Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/Terminaux PTY/i)).toBeInTheDocument();
    expect(screen.getByText(/Carnet SSH & Tunnels/i)).toBeInTheDocument();
    expect(screen.getByText(/Automation Playbooks/i)).toBeInTheDocument();
  });

  it('triggers view selection when a nav tab is clicked', () => {
    render(
      <Sidebar
        activeView="terminal"
        setActiveView={mockSetActiveView}
        sessions={mockSessions}
        activeSessionId="session-1"
        onSelectSession={mockOnSelectSession}
        onCreateSession={mockOnCreateSession}
        onCloseSession={mockOnCloseSession}
        systemStats={null}
      />
    );

    const sshTab = screen.getByText(/Carnet SSH & Tunnels/i);
    fireEvent.click(sshTab);

    expect(mockSetActiveView).toHaveBeenCalledWith('ssh');
  });
});
