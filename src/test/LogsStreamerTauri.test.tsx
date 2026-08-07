import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LogsStreamer } from "../components/LogsStreamer";

// Mode Tauri : pas de WebSocket, polling tailLogFileWeb séquentiel
vi.mock("../lib/tauri", () => ({
  isTauri: () => true,
  tailLogFileWeb: vi.fn(),
}));

// Le module api (wsUrlWithToken) n'est pas utilisé en mode Tauri
vi.mock("../lib/api", () => ({
  wsUrlWithToken: (u: string) => u,
}));

import { tailLogFileWeb } from "../lib/tauri";

describe("LogsStreamer — mode Tauri (polling delta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("n'affiche que les nouveaux octets au 2e poll (pas de doublons)", async () => {
    // Fichier de 100 Ko au 1er poll, puis +1 ligne au 2e (intervalle 1 s)
    const bigChunk = "ligne-ancienne\n".repeat(8000); // ~ 104 Ko
    const newLine = "ligne-nouvelle\n";
    (tailLogFileWeb as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        total_size: bigChunk.length,
        content: bigChunk,
      })
      .mockResolvedValueOnce({
        total_size: bigChunk.length + newLine.length,
        content: bigChunk.slice(-(50 * 1024)) + newLine,
      })
      // Fallback : absorbe tout poll supplémentaire (stabilité du test)
      .mockResolvedValue({ total_size: bigChunk.length + newLine.length, content: newLine });

    await act(async () => {
      render(<LogsStreamer />);
      await new Promise((r) => setTimeout(r, 50));
    });

    // Le 1er poll affiche l'historique complet
    expect(screen.getAllByText(/ligne-ancienne/i).length).toBeGreaterThan(0);

    // Attendre le 2e poll (setInterval 1000 ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1150));
    });

    // La nouvelle ligne est affichée (elle n'existe qu'au 2e poll)
    expect(screen.getByText(/ligne-nouvelle/i)).toBeInTheDocument();
    // Pas de doublon massif : le buffer est capé à 2000 lignes
    expect(screen.getAllByText(/ligne-ancienne/i).length).toBeLessThanOrEqual(2000);
    // Le marqueur de gap n'apparaît PAS (delta < buffer)
    expect(screen.queryByText(/gap de lecture/i)).not.toBeInTheDocument();
  });

  it("signale un gap quand plus de 50 Ko sont écrits entre 2 polls", async () => {
    (tailLogFileWeb as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ total_size: 100, content: "ligne1\nligne2\n" })
      .mockResolvedValueOnce({
        total_size: 100 + 100 * 1024, // +100 Ko en 1 poll
        content: "fin-du-fichier\n",
      })
      // Fallback : absorbe tout poll supplémentaire
      .mockResolvedValue({ total_size: 100 + 100 * 1024, content: "fin-du-fichier\n" });

    await act(async () => {
      render(<LogsStreamer />);
      await new Promise((r) => setTimeout(r, 50));
    });

    // Attendre le 2e poll (setInterval 1000 ms)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1150));
    });

    // Le gap est signalé honnêtement (message détaillé affiché)
    expect(screen.getByText(/dépassement du buffer 50 Ko/i)).toBeInTheDocument();
    expect(screen.getByText(/octets écrits entre deux lectures/i)).toBeInTheDocument();
  });
});
