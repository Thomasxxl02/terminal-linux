import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileManager } from "../components/ProfileManager";

// Mock du stockage sécurisé : valeurs synchrones pré-remplies
vi.mock("../hooks/useSecureStorage", () => ({
  useSecureStorage: (key: string, initial: unknown) => {
    if (key.includes("profile")) {
      return {
        value: [
          {
            id: "profile_bash_default",
            name: "Bash Standard (Dev)",
            shell: "/bin/bash",
            cwd: "/",
            env: { TERM: "xterm-256color" },
            startupScript: "",
          },
        ],
        loading: false,
        setValue: vi.fn(),
        remove: vi.fn(),
      };
    }
    return { value: [], loading: false, setValue: vi.fn(), remove: vi.fn() };
  },
}));

// Mode web : pas de Tauri, pas d'appel backend au rendu
vi.mock("../lib/tauri", () => ({
  isTauri: () => false,
  tauriInvoke: vi.fn().mockResolvedValue({}),
}));

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ shells: [] }) }),
}));

describe("ProfileManager Component", () => {
  const mockOnLaunchProfile = vi.fn();
  const mockOnRestoreSavedTabs = vi.fn();

  const defaultProps = {
    onLaunchProfile: mockOnLaunchProfile,
    activeSessions: [
      { id: "s1", name: "Bash Main", shell: "bash", cwd: "/home/user", createdAt: Date.now() },
    ],
    onRestoreSavedTabs: mockOnRestoreSavedTabs,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the profile manager title and default profile", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    expect(screen.getByText(/Gestionnaire de Profils & Environnements Shell/i)).toBeInTheDocument();
    // Le profil par défaut (Bash) est listé
    expect(await screen.findByText(/Bash Standard/i)).toBeInTheDocument();
  });

  it("launches a profile via onLaunchProfile", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const launchBtn = await screen.findByText("Lancer PTY");
    await act(async () => {
      fireEvent.click(launchBtn);
    });

    expect(mockOnLaunchProfile).toHaveBeenCalled();
  });

  it("opens the create profile modal", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const createBtn = screen.getByText("Créer un Profil");
    await act(async () => {
      fireEvent.click(createBtn);
    });

    // Le formulaire de création est visible (placeholder du nom)
    expect(screen.getByPlaceholderText(/Ex: Python Data Science/i)).toBeInTheDocument();
  });

  it("runs a shell audit and shows the report panel", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const checkBtn = screen.getByText("Vérifier Compatibilité");
    await act(async () => {
      fireEvent.click(checkBtn);
    });

    // Le panneau de rapport s'affiche immédiatement
    expect(screen.getByText(/Rapport d'Intégrité des Shells Système/i)).toBeInTheDocument();
  });

  it("shows an error message when the shell audit fails", async () => {
    // L'audit échoue (API indisponible) → message d'erreur dans le panneau
    const { apiFetch } = await import("../lib/api");
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("API down"));

    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const checkBtn = screen.getByText("Vérifier Compatibilité");
    await act(async () => {
      fireEvent.click(checkBtn);
    });

    expect(screen.getByText("Erreur lors de l'audit des shells.")).toBeInTheDocument();
  });
});
