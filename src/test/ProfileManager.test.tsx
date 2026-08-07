import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileManager } from "../components/ProfileManager";

// Référence partagée pour vérifier les appels de setValue depuis les tests
const { mockSetValue } = vi.hoisted(() => ({ mockSetValue: vi.fn() }));

// Mock du stockage sécurisé : valeurs synchrones pré-remplies
vi.mock("../hooks/useSecureStorage", () => ({
  useSecureStorage: (key: string, _initial: unknown) => {
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
        setValue: mockSetValue,
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

  it("opens the edit modal pre-filled with the profile values", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const editBtn = await screen.findByRole("button", { name: /Éditer le profil Bash Standard/i });
    await act(async () => {
      fireEvent.click(editBtn);
    });

    // Le formulaire d'édition est pré-rempli (nom du profil dans le champ)
    const nameField = await screen.findByPlaceholderText(/Ex: Python Data Science/i);
    expect(nameField).toHaveValue("Bash Standard (Dev)");
    // Le select du shell est présent
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });

  it("deletes a profile after confirmation (non-default only)", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const deleteBtn = await screen.findByRole("button", { name: /Supprimer le profil Bash Standard/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    // Confirmation demandée puis validée
    expect(screen.getByText(/Supprimer le Profil Shell/i)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByText("Supprimer"));
    });

    expect(mockSetValue).toHaveBeenCalled();
    // Le modal de confirmation est refermé
    expect(screen.queryByText(/Supprimer le Profil Shell/i)).not.toBeInTheDocument();
  });

  it("closes the create modal without saving", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer un Profil"));
    });
    expect(screen.getByPlaceholderText(/Ex: Python Data Science/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Annuler"));
    });

    expect(screen.queryByPlaceholderText(/Ex: Python Data Science/i)).not.toBeInTheDocument();
  });

  it("exporte les profils en JSON (lien de téléchargement réel)", async () => {
    // useSecureStorage lit le keyring (mocké vide) → les profils par défaut
    // sont exportés : le lien contient le JSON réel des profils chargés.
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let capturedHref = "";
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => {
        capturedHref = (node as HTMLAnchorElement).getAttribute("href") ?? "";
        return node;
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Exporter"));
    });

    expect(clickSpy).toHaveBeenCalled();
    // Le JSON exporté contient un profil réellement chargé (défaut)
    expect(decodeURIComponent(capturedHref)).toContain("Bash Standard (Dev)");
    appendSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("importe les profils depuis un fichier JSON", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    const file = new File(
      [JSON.stringify([{ id: "imp1", name: "Profil Importé", shell: "/bin/bash", cwd: "/root", color: "#0f0" }])],
      "profils.json",
      { type: "application/json" }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Le stockage est mis à jour avec les profils importés (le mock
    // useSecureStorage est statique → on vérifie l'appel de setValue)
    await waitFor(() => {
      expect(mockSetValue).toHaveBeenCalledWith([
        { id: "imp1", name: "Profil Importé", shell: "/bin/bash", cwd: "/root", color: "#0f0" },
      ]);
    });
  });
});
