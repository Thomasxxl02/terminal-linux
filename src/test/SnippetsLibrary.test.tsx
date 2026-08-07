import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SnippetsLibrary } from '../components/SnippetsLibrary';

describe('SnippetsLibrary Component', () => {
  const mockOnExecuteInTerminal = vi.fn();

  it('renders snippet categories and default snippets', () => {
    render(
      <SnippetsLibrary
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    expect(screen.getByText(/Bibliothèque de Snippets Shell Linux/i)).toBeInTheDocument();
    expect(screen.getByText(/Infos Système Détaillées/i)).toBeInTheDocument();
  });

  it('filters snippets when search query changes', () => {
    render(
      <SnippetsLibrary
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Filtrer les snippets/i);
    fireEvent.change(searchInput, { target: { value: 'Docker' } });

    expect(screen.getByText(/Conteneurs Docker Actifs/i)).toBeInTheDocument();
    expect(screen.queryByText(/Infos Système Détaillées/i)).not.toBeInTheDocument();
  });

  it('triggers terminal execution on button click', () => {
    render(
      <SnippetsLibrary
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    const runButtons = screen.getAllByRole('button', { name: /Exécuter dans le Terminal/i });
    fireEvent.click(runButtons[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
  });
});
