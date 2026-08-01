import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from '../components/CommandPalette';

describe('CommandPalette Component', () => {
  const mockOnClose = vi.fn();
  const mockSetActiveView = vi.fn();
  const mockOnSelectSession = vi.fn();
  const mockOnCreateSession = vi.fn();
  const mockOnExecuteMaintenance = vi.fn();
  const mockOnThemeChange = vi.fn();
  const mockSetSplitMode = vi.fn();
  const mockOnRequestNotifications = vi.fn();

  it('renders command palette modal when isOpen is true', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        setActiveView={mockSetActiveView}
        sessions={[]}
        activeSessionId={null}
        onSelectSession={mockOnSelectSession}
        onCreateSession={mockOnCreateSession}
        onExecuteMaintenance={mockOnExecuteMaintenance}
        onThemeChange={mockOnThemeChange}
        splitMode="single"
        setSplitMode={mockSetSplitMode}
        onRequestNotifications={mockOnRequestNotifications}
        notificationsEnabled={false}
      />
    );

    expect(screen.getByPlaceholderText(/Tapez une commande ou recherchez/i)).toBeInTheDocument();
    expect(screen.getByText(/Créer une nouvelle session PTY/i)).toBeInTheDocument();
  });

  it('filters actions when searching', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        setActiveView={mockSetActiveView}
        sessions={[]}
        activeSessionId={null}
        onSelectSession={mockOnSelectSession}
        onCreateSession={mockOnCreateSession}
        onExecuteMaintenance={mockOnExecuteMaintenance}
        onThemeChange={mockOnThemeChange}
        splitMode="single"
        setSplitMode={mockSetSplitMode}
        onRequestNotifications={mockOnRequestNotifications}
        notificationsEnabled={false}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Tapez une commande ou recherchez/i);
    fireEvent.change(searchInput, { target: { value: 'Tauri' } });

    expect(screen.getByText(/Spécification Architecture Tauri\/Rust/i)).toBeInTheDocument();
    expect(screen.queryByText(/Créer une nouvelle session PTY/i)).not.toBeInTheDocument();
  });

  it('triggers action when item is clicked', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        setActiveView={mockSetActiveView}
        sessions={[]}
        activeSessionId={null}
        onSelectSession={mockOnSelectSession}
        onCreateSession={mockOnCreateSession}
        onExecuteMaintenance={mockOnExecuteMaintenance}
        onThemeChange={mockOnThemeChange}
        splitMode="single"
        setSplitMode={mockSetSplitMode}
        onRequestNotifications={mockOnRequestNotifications}
        notificationsEnabled={false}
      />
    );

    const createPtyBtn = screen.getByText(/Créer une nouvelle session PTY/i);
    fireEvent.click(createPtyBtn);

    expect(mockOnCreateSession).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });
});
