import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaybookSequencer } from "../components/PlaybookSequencer";

const mockSessions = [
  { id: "session-1", name: "Bash Main", shell: "bash", cwd: "/home/user", createdAt: Date.now() },
];

describe("PlaybookSequencer — codes de sortie réels (stopOnError)", () => {
  let subscribeFn: ((data: string) => void) | null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    subscribeFn = null;
  });

  function renderWithOutput() {
    const props = {
      sessions: mockSessions,
      activeSessionId: "session-1",
      onExecuteCommandInTerminal: vi.fn(),
      onOpenTerminalView: vi.fn(),
      subscribeOutput: vi.fn((fn: (data: string) => void) => {
        subscribeFn = fn;
        return () => {
          subscribeFn = null;
        };
      }),
    };
    render(<PlaybookSequencer {...props} />);
    return props;
  }

  it("arrête le pipeline (stopOnError) quand la 1re étape échoue", async () => {
    const props = renderWithOutput();

    // Sélectionner Audit Sécurité (sec1 a stopOnError=true)
    fireEvent.click((await screen.findAllByText(/Audit Sécurité/i))[0]);
    fireEvent.click(screen.getByRole("button", { name: /LANCER LE PIPELINE/i }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // La 1re commande échoue (code 1)
    act(() => {
      subscribeFn?.("sortie commande\n__PB_EXIT_1\n");
    });

    // stopOnError → arrêt immédiat + notification d'échec
    await waitFor(() => {
      expect(screen.getByText(/Pipeline terminé avec des échecs/i)).toBeInTheDocument();
    });
    // L'arrêt a bien eu lieu : les commandes envoyées sont
    // banner + cmd + message d'échec + done header (4), PAS les étapes suivantes
    const commands = props.onExecuteCommandInTerminal.mock.calls.map((c) => c[0] as string);
    expect(commands.length).toBe(4);
    expect(commands.some((c) => c.includes("__PB_EXIT_"))).toBe(true);
  });

  it("exécute toutes les étapes avec succès quand les codes de sortie sont 0", async () => {
    renderWithOutput();

    fireEvent.click((await screen.findAllByText(/Audit Sécurité/i))[0]);
    fireEvent.click(screen.getByRole("button", { name: /LANCER LE PIPELINE/i }));

    // Handshake : chaque étape s'abonne (subscribeFn non-null) avant
    // d'attendre son marqueur — on envoie le marqueur au bon moment.
    await act(async () => {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 5));
        if (subscribeFn) {
          subscribeFn("sortie\n__PB_EXIT_0\n");
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/terminé avec succès/i)).toBeInTheDocument();
    });
  });
});
