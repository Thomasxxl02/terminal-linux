import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemMonitorModal } from '../components/SystemMonitorModal';
import { SystemStats } from '../types';

describe('SystemMonitorModal Component', () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
  });
  
  const mockStats: SystemStats = {
    platform: 'linux',
    release: '5.15.0',
    arch: 'x64',
    hostname: 'test-host',
    cpus: 4,
    cpuModel: 'Intel Core i7',
    totalMem: 16 * 1024 * 1024 * 1024,
    freeMem: 8 * 1024 * 1024 * 1024,
    usedMem: 8 * 1024 * 1024 * 1024,
    memUsagePercent: 50,
    uptime: 3600,
    loadavg: [1.5, 1.0, 0.5],
    disk: {
      total: 100 * 1024 * 1024 * 1024,
      free: 60 * 1024 * 1024 * 1024,
      used: 40 * 1024 * 1024 * 1024,
      percent: 40
    },
    processes: [
      { pid: 101, name: 'node server.ts', cpu: 12.5, mem: 4.2, user: 'root' },
      { pid: 102, name: 'bash', cpu: 0.5, mem: 0.2, user: 'user' }
    ]
  };

  it('renders system stats information successfully', () => {
    render(
      <SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />
    );

    // Header and machine info
    expect(screen.getByText(/Centre de Télémétries & Ressources Système/i)).toBeInTheDocument();
    expect(screen.getByText(/Intel Core i7/i)).toBeInTheDocument();
    expect(screen.getByText(/linux \(x64\)/i)).toBeInTheDocument();
  });

  it('filters processes list via search query input', () => {
    render(
      <SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />
    );

    // Both should be initially visible
    expect(screen.getByText('node server.ts')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Filtrer par PID, nom ou utilisateur/i);
    fireEvent.change(searchInput, { target: { value: 'node' } });

    // Node should be there, bash should be filtered out
    expect(screen.getByText('node server.ts')).toBeInTheDocument();
    expect(screen.queryByText('bash')).not.toBeInTheDocument();
  });

  it('charge l\'historique persistant depuis localStorage au montage', () => {
    // 3 échantillons réels d\'une session précédente
    window.localStorage.setItem(
      'terminal_system_history',
      JSON.stringify([
        { cpu: 10, mem: 30, time: '10:00:01' },
        { cpu: 15, mem: 32, time: '10:00:05' },
        { cpu: 12, mem: 31, time: '10:00:09' },
      ])
    );

    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    // L'historique chargé est visible (points persistés affichés)
    // — 2 graphiques (CPU + MEM) chacun avec son compteur ; le useEffect
    // ajoute un point (3 chargés + 1 reçu) → compteur 4
    expect(screen.getAllByText(/4 pts/i).length).toBeGreaterThan(0);
  });

  it('persiste les nouveaux échantillons dans localStorage', async () => {
    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    // Le polling ajoute un point (stats reçues) → écrit dans localStorage
    await waitFor(() => {
      const saved = window.localStorage.getItem('terminal_system_history');
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved ?? '[]') as { cpu: number; mem: number }[];
      expect(parsed.length).toBeGreaterThan(0);
      // Les valeurs sont les mesures réelles (CPU ~37 % pour 1.5/4 cores, mem 50 %)
      expect(parsed[0].mem).toBe(50);
    });
  });
});
