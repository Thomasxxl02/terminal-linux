import { render, screen, fireEvent,} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SystemMonitorModal } from "../components/SystemMonitorModal";

const mockStats = {
  platform: "linux",
  release: "5.15.0",
  arch: "x64",
  hostname: "test-host",
  cpus: 4,
  cpuModel: "Intel Core i7",
  cpuCores: [
    { core: 1, model: "Intel Core i7", speed: 2400 },
    { core: 2, model: "Intel Core i7", speed: 2400 },
  ],
  totalMem: 16 * 1024 * 1024 * 1024,
  freeMem: 8 * 1024 * 1024 * 1024,
  usedMem: 8 * 1024 * 1024 * 1024,
  memUsagePercent: 50,
  uptime: 3600,
  loadavg: [1.5, 1.0, 0.5],
  disk: { total: 100e9, free: 60e9, used: 40e9, percent: 40 },
  processes: [
    { pid: 101, name: "node server.ts", cpu: 12.5, mem: 4.2, user: "root" },
    { pid: 102, name: "bash", cpu: 0.5, mem: 0.2, user: "user" },
  ],
  networkInterfaces: [
    { name: "eth0", address: "192.168.1.10", family: "IPv4", mac: "aa:bb", internal: false, netmask: "255.255.255.0" },
  ],
  nodeRuntime: {
    nodeVersion: "v22.14.0",
    v8Version: "12.4",
    processUptime: 7200,
    pid: 3000,
    memoryUsage: { rss: 100_000_000, heapTotal: 50_000_000, heapUsed: 30_000_000 },
  },
  userInfo: { username: "root", homedir: "/root", shell: "/bin/bash" },
  systemDetails: { type: "Linux", endianness: "LE", tmpdir: "/tmp" },
  activePtySessions: 2,
};

describe("SystemMonitorModal — onglets et actions", () => {
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    mockOnRefresh.mockClear();
    vi.restoreAllMocks();
  });

  it("bascule sur l'onglet Réseau et affiche les interfaces", () => {
    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /Réseau & IPs/i }));
    expect(screen.getByText("eth0")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
  });

  it("bascule sur l'onglet Node.js et affiche la version", () => {
    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /Node.js/i }));
    expect(screen.getByText("v22.14.0")).toBeInTheDocument();
  });

  it("bascule sur l'onglet Matériel et affiche les cœurs", () => {
    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /Matériel/i }));
    expect(screen.getByText("Cœur #1")).toBeInTheDocument();
    expect(screen.getByText("Cœur #2")).toBeInTheDocument();
  });

  it("déclenche le rafraîchissement manuel", () => {
    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /Forcer l'actualisation/i }));
    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it("copie le rapport système dans le presse-papiers", async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: clipboardWrite } });

    render(<SystemMonitorModal stats={mockStats} onRefresh={mockOnRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: /Copier le rapport/i }));

    expect(clipboardWrite).toHaveBeenCalled();
    const report = clipboardWrite.mock.calls[0][0] as string;
    expect(report).toContain("Intel Core i7");
    expect(report).toContain("RAPPORT DE TÉLÉMÉTRIE");
    vi.unstubAllGlobals();
  });

  it("affiche le chargement quand les stats sont null", () => {
    render(<SystemMonitorModal stats={null} onRefresh={mockOnRefresh} />);
    expect(screen.getByText(/Chargement des télémétries/i)).toBeInTheDocument();
  });
});
