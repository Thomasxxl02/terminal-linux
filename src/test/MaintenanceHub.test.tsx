import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaintenanceHub } from '../components/MaintenanceHub';

// Référence partagée : valeur des macros contrôlable par test + spy setValue
const { mockSetValue, macrosState } = vi.hoisted(() => ({
  mockSetValue: vi.fn(),
  macrosState: { value: null as unknown },
}));

// Mock du stockage sécurisé : valeur statique pré-remplie (pattern ProfileManager.test.tsx)
vi.mock('../hooks/useSecureStorage', () => ({
  useSecureStorage: () => ({
    value: macrosState.value,
    loading: false,
    setValue: mockSetValue,
    remove: vi.fn(),
  }),
}));

const SESSIONS = [
  { id: 's1', name: 'Bash', shell: 'bash', cwd: '/', createdAt: 1 },
  { id: 's2', name: 'Zsh', shell: 'zsh', cwd: '/home', createdAt: 2 },
];

const MACRO_A = { id: 'm1', title: 'Macro A', command: 'echo a', description: 'Desc A', category: 'Général' };
const MACRO_B = { id: 'm2', title: 'Macro B', command: 'echo b', description: 'Desc B', category: 'Réseau' };

describe('MaintenanceHub Component', () => {
  const mockOnExecuteInTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    macrosState.value = null;
    vi.useRealTimers();
  });

  const renderHub = (props: Partial<Parameters<typeof MaintenanceHub>[0]> = {}) => {
    return render(
      <MaintenanceHub
        sessions={props.sessions ?? []}
        activeSessionId={props.activeSessionId ?? null}
        onExecuteInTerminal={props.onExecuteInTerminal ?? mockOnExecuteInTerminal}
      />
    );
  };

  it('renders maintenance tasks list and header', () => {
    renderHub();

    expect(screen.getByText(/Centre de Maintenance Linux/i)).toBeInTheDocument();
    expect(screen.getByText(/Mise à jour du système \(APT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Nettoyage du cache d'installation/i)).toBeInTheDocument();
    // Aucun terminal connecté : option par défaut du sélecteur de session
    expect(screen.getByText('Aucun terminal connecté')).toBeInTheDocument();
    // Les macros par défaut sont affichées
    expect(screen.getByText('Intégrité Globale Système')).toBeInTheDocument();
    expect(screen.getByText('Nettoyage du cache DNS')).toBeInTheDocument();
  });

  it('triggers task execution when "Exécuter la tâche" button is clicked', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub();

    const executeButtons = screen.getAllByRole('button', { name: /Exécuter la tâche/i });
    fireEvent.click(executeButtons[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Envoyé au terminal !')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Le statut "Envoyé" revient à l'état normal après le délai
    expect(screen.queryByText('Envoyé au terminal !')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  // ── Nouveaux tests : branches non couvertes ──────────────────────────

  it('synchronise la session cible quand activeSessionId change', () => {
    const { rerender } = renderHub({ sessions: SESSIONS });

    const sessionSelect = screen.getAllByRole('combobox')[0];
    expect(sessionSelect).toHaveValue('s1');

    rerender(
      <MaintenanceHub
        sessions={SESSIONS}
        activeSessionId="s2"
        onExecuteInTerminal={mockOnExecuteInTerminal}
      />
    );

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('s2');
  });

  it('exécute une tâche vers la session sélectionnée dans le sélecteur', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub({ sessions: SESSIONS });

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 's2' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Exécuter la tâche/i })[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain('apt-get update');
    expect(mockOnExecuteInTerminal.mock.calls[0][1]).toBe('s2');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });

  it('bascule le service cible via les boutons rapides', () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: 'nginx' }));

    expect(screen.getByText('systemctl status nginx --no-pager || service nginx status')).toBeInTheDocument();
    expect(screen.getByText('sudo systemctl restart nginx || sudo service nginx restart')).toBeInTheDocument();
  });

  it('lance une action du contrôleur de services', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub({ sessions: SESSIONS });

    fireEvent.click(screen.getByRole('button', { name: 'docker' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Lancer/i })[0]);

    // Première action du service docker : "Statut Actuel"
    expect(mockOnExecuteInTerminal).toHaveBeenCalledWith(
      'systemctl status docker --no-pager || service docker status',
      's1'
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });

  it('met à jour le seuil d\'alerte disque', () => {
    renderHub();

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '95' } });

    expect(screen.getByText(/Scan les partitions supérieures à 95% d'utilisation/i)).toBeInTheDocument();
  });

  it('met à jour le nombre de cœurs CPU du diagnostic', () => {
    renderHub();

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '8' } });

    expect(screen.getByText(/Inspecte les 8 processus CPU les plus chauds/i)).toBeInTheDocument();
  });

  it('lance le diagnostic de seuil disque', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub({ sessions: SESSIONS });

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '95' } });
    fireEvent.click(screen.getByText('Vérification Seuil Disque'));

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain('df -h');
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain('> 95');
    expect(mockOnExecuteInTerminal.mock.calls[0][1]).toBe('s1');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });

  it('lance le diagnostic CPU', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub({ sessions: SESSIONS });

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '8' } });
    fireEvent.click(screen.getByText('Docteur Processeurs'));

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain('head -n 8');
    expect(mockOnExecuteInTerminal.mock.calls[0][1]).toBe('s1');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });

  it('ajoute une macro avec les valeurs par défaut (description/catégorie)', () => {
    renderHub();

    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Ma Macro' } });
    fireEvent.change(screen.getByPlaceholderText('Commande (ex: free -m)'), {
      target: { value: 'df -h' },
    });

    const form = screen.getByPlaceholderText('Nom').closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(mockSetValue).toHaveBeenCalledTimes(1);
    expect(mockSetValue).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'custom_1' }),
      expect.objectContaining({ id: 'custom_2' }),
      expect.objectContaining({
        id: expect.stringMatching(/^macro_/),
        title: 'Ma Macro',
        command: 'df -h',
        description: 'Script de maintenance personnalisé.',
        category: 'Général',
      }),
    ]);
  });

  it('ajoute une macro avec description et catégorie personnalisées', () => {
    renderHub();

    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Backup' } });
    fireEvent.change(screen.getByPlaceholderText('Catégorie (Optionnel)'), {
      target: { value: 'Sauvegarde' },
    });
    fireEvent.change(screen.getByPlaceholderText('Description rapide...'), {
      target: { value: 'Sauvegarde incrémentale' },
    });
    fireEvent.change(screen.getByPlaceholderText('Commande (ex: free -m)'), {
      target: { value: 'rsync -av' },
    });

    const form = screen.getByPlaceholderText('Nom').closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(mockSetValue).toHaveBeenCalledTimes(1);
    const payload = mockSetValue.mock.calls[0][0] as { title: string; description: string; category: string }[];
    const added = payload[payload.length - 1];
    expect(added.title).toBe('Backup');
    expect(added.description).toBe('Sauvegarde incrémentale');
    expect(added.category).toBe('Sauvegarde');
  });

  it('n\'ajoute pas de macro si le titre ou la commande est vide', () => {
    renderHub();

    const form = screen.getByPlaceholderText('Nom').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(mockSetValue).not.toHaveBeenCalled();

    // Titre seul, sans commande
    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Sans commande' } });
    fireEvent.submit(form);
    expect(mockSetValue).not.toHaveBeenCalled();
  });

  it('supprime une macro enregistrée', () => {
    macrosState.value = [MACRO_A, MACRO_B];
    renderHub();

    expect(screen.getByText('Macro A')).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Supprimer')[0]);

    expect(mockSetValue).toHaveBeenCalledTimes(1);
    expect(mockSetValue).toHaveBeenCalledWith([MACRO_B]);
  });

  it('exécute une macro enregistrée', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    macrosState.value = [MACRO_A];
    renderHub({ sessions: SESSIONS });

    fireEvent.click(screen.getByTitle('Exécuter'));

    expect(mockOnExecuteInTerminal).toHaveBeenCalledWith('echo a', 's1');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });

  it('affiche l\'état vide quand aucune macro n\'est enregistrée', () => {
    macrosState.value = [];
    renderHub();

    expect(screen.getByText('Aucun raccourci enregistré.')).toBeInTheDocument();
  });

  it('alimente l\'historique de session après une exécution', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderHub();

    fireEvent.click(screen.getByText('Vérification Seuil Disque'));

    expect(screen.getByText('Alerte espace disque')).toBeInTheDocument();
    expect(screen.getByText(/^df -h \| awk/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();
  });
});
