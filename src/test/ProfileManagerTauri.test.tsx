import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileManager } from "../components/ProfileManager";

vi.mock("../hooks/useSecureStorage", () => ({
  useSecureStorage: (_key: string, _initial: unknown) => {
    if (_key.includes("profile")) {
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

// Mode Tauri : l'audit des shells passe par tauriInvoke("check_shells")
vi.mock("../lib/tauri", () => ({
  isTauri: () => true,
  tauriInvoke: vi.fn().mockResolvedValue([
    { name: "bash", path: "/bin/bash", present: true, version: "5.2.21(1)-release" },
    { name: "zsh", path: "/bin/zsh", present: true, version: "5.9" },
  ]),
}));

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ shells: [] }) }),
}));

import { tauriInvoke } from "../lib/tauri";

describe("ProfileManager — mode Tauri (audit shells Rust)", () => {
  const defaultProps = {
    onLaunchProfile: vi.fn(),
    activeSessions: [],
    onRestoreSavedTabs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lance l'audit des shells via tauriInvoke (check_shells)", async () => {
    await act(async () => {
      render(<ProfileManager {...defaultProps} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Vérifier Compatibilité"));
    });

    expect(tauriInvoke).toHaveBeenCalledWith("check_shells");
    // Le rapport s'affiche avec les shells réels détectés par Rust
    expect(await screen.findByText(/Rapport d'Intégrité des Shells Système/i)).toBeInTheDocument();
  });
});
