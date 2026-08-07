import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  NetworkTab,
  NodeTab,
  HardwareTab,
  ProcessesTable,
} from "../components/SystemMonitorTabs";
import { SystemStats } from "../types";

const baseStats: SystemStats = {
  platform: "linux",
  release: "6.8.0",
  arch: "x86_64",
  hostname: "vps",
  cpuModel: "Intel",
  cpus: 2,
  totalMem: 8_000_000_000,
  freeMem: 4_000_000_000,
  usedMem: 4_000_000_000,
  memUsagePercent: 50,
  uptime: 3600,
  loadavg: [0.5, 0.3, 0.1],
  networkInterfaces: [
    { name: "eth0", address: "192.168.1.10", netmask: "255.255.255.0", internal: false, family: "IPv4", mac: "aa:bb" },
    { name: "lo", address: "127.0.0.1", netmask: "255.0.0.0", internal: true, family: "IPv4", mac: "00:00" },
  ],
  nodeRuntime: {
    nodeVersion: "v22.14.0",
    v8Version: "12.4.254.21",
    processUptime: 7200,
    pid: 3000,
    memoryUsage: { rss: 100_000_000, heapTotal: 50_000_000, heapUsed: 30_000_000 },
  },
  userInfo: { username: "root", homedir: "/root", shell: "/bin/bash" },
  systemDetails: { type: "Linux", endianness: "LE", tmpdir: "/tmp" },
  cpuCores: [{ core: 1, model: "Intel", speed: 2400 }],
  disk: { total: 100_000_000_000, free: 60_000_000_000, used: 40_000_000_000, percent: 40 },
  processes: [
    { pid: 1, user: "root", cpu: 5.5, mem: 1.2, name: "systemd" },
    { pid: 2, user: "thomas", cpu: 0.1, mem: 0.5, name: "code" },
  ],
};

describe("NetworkTab", () => {
  it("affiche les interfaces réseau détectées", () => {
    render(<NetworkTab stats={baseStats} />);
    expect(screen.getByText("eth0")).toBeInTheDocument();
    expect(screen.getByText("lo")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.10")).toBeInTheDocument();
    expect(screen.getByText("Interfaces Réseau Détectées (2)")).toBeInTheDocument();
  });

  it("filtre les interfaces par recherche", () => {
    render(<NetworkTab stats={baseStats} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrer par IP ou interface..."), {
      target: { value: "eth" },
    });
    expect(screen.getByText("eth0")).toBeInTheDocument();
    expect(screen.queryByText("lo")).not.toBeInTheDocument();
  });

  it("affiche un message si aucun résultat", () => {
    render(<NetworkTab stats={baseStats} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrer par IP ou interface..."), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText(/Aucune interface ne correspond/)).toBeInTheDocument();
  });
});

describe("NodeTab", () => {
  it("affiche la version Node, l'uptime et la mémoire V8", () => {
    render(<NodeTab stats={baseStats} />);
    expect(screen.getByText("v22.14.0")).toBeInTheDocument();
    expect(screen.getByText("2h 0m")).toBeInTheDocument();
    expect(screen.getByText("RSS (Resident Set Size)")).toBeInTheDocument();
    // 100_000_000 / 1024² = 95.367 → "95.37 MB"
    expect(screen.getByText("95.37 MB")).toBeInTheDocument();
  });
});

describe("HardwareTab", () => {
  it("affiche l'architecture, l'utilisateur et les cœurs", () => {
    render(<HardwareTab stats={baseStats} />);
    expect(screen.getByText("x86_64")).toBeInTheDocument();
    expect(screen.getByText("root")).toBeInTheDocument();
    expect(screen.getByText("Détail des Cœurs de Processeur (2 Coeurs)")).toBeInTheDocument();
    expect(screen.getByText("Cœur #1")).toBeInTheDocument();
  });
});

describe("ProcessesTable", () => {
  it("affiche la liste des processus triée par CPU", () => {
    render(<ProcessesTable stats={baseStats} onKillProcess={vi.fn()} />);
    expect(screen.getByText("Gestionnaire de Processus (TOP)")).toBeInTheDocument();
    expect(screen.getByText("systemd")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
  });

  it("filtre par recherche", () => {
    render(<ProcessesTable stats={baseStats} onKillProcess={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrer par PID, nom ou utilisateur..."), {
      target: { value: "systemd" },
    });
    expect(screen.getByText("systemd")).toBeInTheDocument();
    expect(screen.queryByText("code")).not.toBeInTheDocument();
  });

  it("affiche un message si aucun processus ne correspond", () => {
    render(<ProcessesTable stats={baseStats} onKillProcess={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Filtrer par PID, nom ou utilisateur..."), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText(/Aucun processus ne correspond/)).toBeInTheDocument();
  });

  it("confirme puis arrête un processus via SIGTERM", async () => {
    const onKill = vi.fn().mockResolvedValue(undefined);
    render(<ProcessesTable stats={baseStats} onKillProcess={onKill} />);

    // Bouton SIGTERM du premier processus (systemd)
    const sigtermButtons = screen.getAllByText("SIGTERM");
    fireEvent.click(sigtermButtons[0]);

    // Confirmation
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onKill).toHaveBeenCalledWith(1);
  });

  it("affiche une erreur si l'arrêt du processus échoue", async () => {
    const onKill = vi.fn().mockRejectedValue(new Error("refusé"));
    render(<ProcessesTable stats={baseStats} onKillProcess={onKill} />);

    fireEvent.click(screen.getAllByText("SIGTERM")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(await screen.findByText(/Impossible d'arrêter le processus/)).toBeInTheDocument();
  });

  it("affiche un message de succès après arrêt", async () => {
    const onKill = vi.fn().mockResolvedValue(undefined);
    render(<ProcessesTable stats={baseStats} onKillProcess={onKill} />);

    fireEvent.click(screen.getAllByText("SIGTERM")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));

    expect(await screen.findByText(/a été arrêté/)).toBeInTheDocument();
  });
});
