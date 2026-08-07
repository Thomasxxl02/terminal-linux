import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MaintenanceHub } from '../components/MaintenanceHub';

describe('MaintenanceHub Component', () => {
  const mockOnExecuteInTerminal = vi.fn();

  it('renders maintenance tasks list and header', () => {
    render(
      <MaintenanceHub
        sessions={[]}
        activeSessionId={null}
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    expect(screen.getByText(/Centre de Maintenance Linux/i)).toBeInTheDocument();
    expect(screen.getByText(/Mise à jour du système \(APT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Nettoyage du cache d'installation/i)).toBeInTheDocument();
  });

  it('triggers task execution when "Exécuter la tâche" button is clicked', () => {
    render(
      <MaintenanceHub
        sessions={[]}
        activeSessionId={null}
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const executeButtons = screen.getAllByRole('button', { name: /Exécuter la tâche/i });
    fireEvent.click(executeButtons[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
  });
});
