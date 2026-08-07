import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SshTunnelManager } from "../components/SshTunnelManager";
import { apiFetch } from "../lib/api";
import { isTauri, tauriInvoke } from "../lib/tauri";

// Mode web (isTauri false) : le diagnostic utilise /api/network/port-check
vi.mock("../lib/tauri", () => ({
  isTauri: vi.fn(() => false),
  tauriInvoke: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const HOSTS_KEY = "terminal_ssh_hosts";
const TUNNELS_KEY = "terminal_ssh_tunnels";

const makeHost = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Hôte ${id}`,
  host: "192.168.1.100",
  port: 22,
  username: "ubuntu",
  authType: "password",
  ...overrides,
});

const makeTunnel = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Tunnel ${id}`,
  hostId: "h1",
  type: "local",
  localPort: 3306,
  remoteHost: "db.internal",
  remotePort: 3306,
  status: "inactive",
  createdAt: Date.now(),
  ...overrides,
});

describe("SshTunnelManager Component", () => {
  const mockOnExecuteInTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.useRealTimers();
  });

  // Rendu async : vide le chargement async de useSecureStorage (hôtes SSH)
  // dans act() pour éviter tout warning "not wrapped in act".
  const renderManager = async () => {
    await act(async () => {
      render(<SshTunnelManager onExecuteInTerminal={mockOnExecuteInTerminal} />);
    });
  };

  it("renders SshTunnelManager headers (aucun tunnel fictif)", async () => {
    await renderManager();

    expect(screen.getByText(/Générateur & Testeur de Tunnels SSH \/ Reverse Proxy/i)).toBeInTheDocument();
    // Aucun tunnel fictif pré-rempli
    expect(screen.queryByText(/Redirection MySQL Staging/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reverse Proxy Dev Webserver/i)).not.toBeInTheDocument();
  });

  it("filters tunnels by searching", async () => {
    // Pré-remplit avec des tunnels créés par l'utilisateur (données de test)
    window.localStorage.setItem(TUNNELS_KEY, JSON.stringify([
      { id: 't1', name: 'Redirection MySQL Staging', hostId: 'h1', type: 'local', localPort: 3306, remoteHost: 'db.internal', remotePort: 3306, status: 'active' },
      { id: 't2', name: 'Reverse Proxy Dev Webserver', hostId: 'h2', type: 'remote', localPort: 8080, remoteHost: 'localhost', remotePort: 80, status: 'inactive' }
    ]));

    await renderManager();

    const searchInput = screen.getByPlaceholderText(/Rechercher nom, port local, hôte/i);
    fireEvent.change(searchInput, { target: { value: "MySQL" } });

    expect(screen.getByText(/Redirection MySQL Staging/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reverse Proxy Dev Webserver/i)).not.toBeInTheDocument();
  });

  it("recherche les tunnels par port local", async () => {
    window.localStorage.setItem(TUNNELS_KEY, JSON.stringify([
      makeTunnel("t1", { name: "MySQL", localPort: 3306 }),
      makeTunnel("t2", { name: "Web", localPort: 8080, type: "remote", remotePort: 80, remoteHost: "localhost" }),
    ]));

    await renderManager();

    fireEvent.change(screen.getByPlaceholderText(/Rechercher nom, port local, hôte/i), {
      target: { value: "3306" },
    });

    expect(screen.getByText("MySQL")).toBeInTheDocument();
    expect(screen.queryByText("Web")).not.toBeInTheDocument();
  });

  it("triggers terminal command execution when Exécuter is clicked", async () => {
    // Le tunnel référence un hôte SSH (hostId) — il faut les deux pour la commande
    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([
      { id: 'h1', name: 'Serveur Prod', host: '192.168.1.100', port: 22, username: 'ubuntu', authType: 'key' }
    ]));
    window.localStorage.setItem(TUNNELS_KEY, JSON.stringify([
      { id: 't1', name: 'Redirection MySQL Staging', hostId: 'h1', type: 'local', localPort: 3306, remoteHost: 'db.internal', remotePort: 3306, status: 'inactive' }
    ]));

    await renderManager();

    const executeBtns = await screen.findAllByRole("button", { name: /Exécuter Terminal/i });
    fireEvent.click(executeBtns[0]);

    expect(mockOnExecuteInTerminal).toHaveBeenCalledTimes(1);
    expect(mockOnExecuteInTerminal.mock.calls[0][0]).toContain("-L");
  });

  it("opens create tunnel modal", async () => {
    await renderManager();

    const createBtn = screen.getByRole("button", { name: /Créer un Tunnel SSH/i });
    fireEvent.click(createBtn);

    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();
  });

  it("exécute un diagnostic RÉEL : interroge le port local et affiche le résultat", async () => {
    // Port libre → le tunnel n'écoute pas
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ available: true }),
    });

    window.localStorage.setItem(TUNNELS_KEY, JSON.stringify([
      {
        id: "t1",
        name: "Tunnel Test",
        hostId: "h1",
        type: "local",
        localPort: 9090,
        remoteHost: "db.internal",
        remotePort: 3306,
        status: "inactive",
      },
    ]));

    await renderManager();

    fireEvent.click(screen.getByTitle("Lancer le diagnostic réseau"));

    // L'API port-check a été interrogée avec le port RÉEL du tunnel
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("port-check?port=9090"));
    });

    // Le résultat réel est affiché (pas de simulation)
    await waitFor(() => {
      expect(screen.getByText(/Port local 9090: LIBRE/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/aucune donnée inventée/i)).toBeInTheDocument();
    expect(screen.queryByText(/Simulation/i)).not.toBeInTheDocument();
  });

  it("exporte les tunnels en JSON (lien de téléchargement réel)", async () => {
    window.localStorage.setItem(TUNNELS_KEY, JSON.stringify([
      { id: "t1", name: "Tunnel A", hostId: "h1", type: "local", localPort: 8080, remoteHost: "db", remotePort: 3306, status: "inactive" },
    ]));

    await renderManager();

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    // Capture le lien créé par le handler avant son retrait (a.remove())
    let capturedHref = "";
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => {
        const a = node as HTMLAnchorElement;
        capturedHref = a.getAttribute("href") ?? "";
        return node;
      });

    await act(async () => {
      fireEvent.click(screen.getByText("Exporter"));
    });

    // Le lien de téléchargement contient le JSON réel des tunnels
    expect(clickSpy).toHaveBeenCalled();
    expect(decodeURIComponent(capturedHref)).toContain('"name": "Tunnel A"');
    appendSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("importe les tunnels depuis un fichier JSON", async () => {
    await renderManager();

    const file = new File(
      [
        JSON.stringify([
          { id: "imp1", name: "Tunnel Importé", hostId: "h1", type: "dynamic", localPort: 9090, remoteHost: "localhost", remotePort: 0, status: "inactive" },
        ]),
      ],
      "tunnels.json",
      { type: "application/json" }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText("Tunnel Importé")).toBeInTheDocument();
    });
  });

  // ── Nouveaux tests : branches non couvertes ──────────────────────────

  it("génère la commande SSH complète (port custom, clé, keepalive, exitOnFailure)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText");

    window.localStorage.setItem(
      HOSTS_KEY,
      JSON.stringify([
        makeHost("h1", { port: 2222, authType: "key", privateKeyPath: "/home/u/.ssh/id_rsa" }),
      ])
    );
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([
        makeTunnel("t1", { serverAliveInterval: 30, exitOnFailure: true }),
      ])
    );

    await renderManager();

    fireEvent.click(screen.getAllByTitle("Copier la commande SSH brute")[0]);

    expect(writeSpy).toHaveBeenCalledWith(
      'ssh -N -p 2222 -i "/home/u/.ssh/id_rsa" -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -L 3306:db.internal:3306 ubuntu@192.168.1.100'
    );
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    vi.useRealTimers();
  });

  it("génère les commandes remote (-R) et dynamic (-D)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText");

    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([makeHost("h1")]));
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([
        makeTunnel("r1", { type: "remote", localPort: 9000, remoteHost: "app.local", remotePort: 8080 }),
        makeTunnel("d1", { type: "dynamic", localPort: 1080, remoteHost: "127.0.0.1", remotePort: 0 }),
      ])
    );

    await renderManager();

    const copyButtons = screen.getAllByTitle("Copier la commande SSH brute");
    fireEvent.click(copyButtons[0]);
    fireEvent.click(copyButtons[1]);

    expect(writeSpy.mock.calls[0][0]).toContain("-R 8080:app.local:9000");
    expect(writeSpy.mock.calls[1][0]).toContain("-D 1080");
    // Le tunnel dynamique ne doit pas afficher de "Cible distante"
    expect(screen.getAllByText("Cible distante:").length).toBe(1);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    vi.useRealTimers();
  });

  it("retourne un message dédié quand l'hôte SSH est inconnu", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText");

    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([makeHost("h1")]));
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { hostId: "h-inexistant" })])
    );

    await renderManager();

    fireEvent.click(screen.getAllByTitle("Copier la commande SSH brute")[0]);
    expect(writeSpy).toHaveBeenCalledWith("# Hôte SSH non configuré");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    vi.useRealTimers();
  });

  it("crée un nouveau tunnel via le modal", async () => {
    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([makeHost("h1")]));

    await renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Créer un Tunnel SSH/i }));
    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ex: Redirection PostgreSQL"), {
      target: { value: "Tunnel Créé" },
    });
    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[0], { target: { value: "9000" } });
    fireEvent.change(spinbuttons[1], { target: { value: "80" } });
    fireEvent.change(screen.getByPlaceholderText("localhost ou 127.0.0.1"), {
      target: { value: "db.prod" },
    });

    fireEvent.click(screen.getByText("Enregistrer"));

    expect(screen.getByText("Tunnel Créé")).toBeInTheDocument();
    expect(screen.queryByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).not.toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(TUNNELS_KEY) as string) as { name: string; localPort: number }[];
    expect(stored[0].name).toBe("Tunnel Créé");
    expect(stored[0].localPort).toBe(9000);
  });

  it("ignore la soumission du formulaire vide (garde)", async () => {
    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([makeHost("h1")]));

    await renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Créer un Tunnel SSH/i }));
    const form = screen.getByPlaceholderText("Ex: Redirection PostgreSQL").closest("form") as HTMLFormElement;
    fireEvent.submit(form);

    // Aucun tunnel créé : le modal reste ouvert
    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();
    expect(screen.queryByText("Exécuter Terminal")).not.toBeInTheDocument();
  });

  it("édite un tunnel existant via le modal", async () => {
    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([makeHost("h1")]));
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { name: "Ancien Nom" })])
    );

    await renderManager();

    fireEvent.click(screen.getByTitle("Éditer le tunnel"));
    expect(screen.getByText("Éditer le Tunnel SSH")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("Ex: Redirection PostgreSQL");
    expect(nameInput).toHaveValue("Ancien Nom");
    fireEvent.change(nameInput, { target: { value: "Nouveau Nom" } });
    fireEvent.click(screen.getByText("Enregistrer"));

    expect(screen.getByText("Nouveau Nom")).toBeInTheDocument();
    expect(screen.queryByText("Ancien Nom")).not.toBeInTheDocument();
  });

  it("supprime un tunnel", async () => {
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { name: "À Supprimer" })])
    );

    await renderManager();

    fireEvent.click(screen.getByTitle("Supprimer"));

    expect(screen.queryByText("À Supprimer")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TUNNELS_KEY) as string)).toEqual([]);
  });

  it("bascule un tunnel actif en inactif via Fermer", async () => {
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([
        makeTunnel("t1", { name: "Tunnel Actif", status: "active" }),
        makeTunnel("t2", { name: "Tunnel Inactif", status: "inactive" }),
      ])
    );

    await renderManager();

    expect(screen.getByText("Fermer")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Fermer"));

    // Les deux tunnels sont maintenant inactifs : plus de bouton "Fermer"
    expect(screen.getAllByText("Exécuter Terminal").length).toBe(2);
    expect(screen.queryByText("Fermer")).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(TUNNELS_KEY) as string) as { id: string; status: string }[];
    expect(stored.find((t) => t.id === "t1")?.status).toBe("inactive");
    expect(stored.find((t) => t.id === "t2")?.status).toBe("inactive");
  });

  it("alerte sur un fichier JSON invalide à l'import", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await renderManager();

    const file = new File(["contenu non JSON"], "tunnels.json", { type: "application/json" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Erreur de parsing JSON. Vérifiez le contenu du fichier.");
    });
    alertSpy.mockRestore();
  });

  it("alerte quand le fichier importé n'est pas un tableau", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await renderManager();

    const file = new File([JSON.stringify({ name: "pas un tableau" })], "tunnels.json", {
      type: "application/json",
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Format JSON invalide. Le fichier doit contenir un tableau de tunnels."
      );
    });
    alertSpy.mockRestore();
  });

  it("ignore un événement d'import sans fichier", async () => {
    await renderManager();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [] } });
    });

    expect(screen.getByText("Aucun tunnel SSH ne correspond.")).toBeInTheDocument();
  });

  it("le bouton Importer déclenche le clic sur l'input fichier caché", async () => {
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    await renderManager();

    fireEvent.click(screen.getByText("Importer"));

    expect(inputClickSpy).toHaveBeenCalled();
    inputClickSpy.mockRestore();
  });

  it("signale un port invalide dans le détecteur de conflits", async () => {
    await renderManager();

    fireEvent.change(screen.getByPlaceholderText("3306, 8080, 5432..."), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByText("Tester le Port"));

    await waitFor(() => {
      expect(screen.getByText("Port invalide.")).toBeInTheDocument();
    });
  });

  it("détecte un port libre côté web", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ available: true }),
    });
    await renderManager();

    fireEvent.change(screen.getByPlaceholderText("3306, 8080, 5432..."), {
      target: { value: "8080" },
    });
    fireEvent.click(screen.getByText("Tester le Port"));

    await waitFor(() => {
      expect(screen.getByText(/Le port local 8080 est libre et prêt/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Vous pouvez l'utiliser directement/i)).toBeInTheDocument();
  });

  it("détecte un port occupé côté web avec suggestions", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ available: false }),
    });
    await renderManager();

    fireEvent.change(screen.getByPlaceholderText("3306, 8080, 5432..."), {
      target: { value: "8080" },
    });
    fireEvent.click(screen.getByText("Tester le Port"));

    await waitFor(() => {
      expect(screen.getByText(/Le port local 8080 est OCCUPÉ/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/lsof -i :8080/)).toBeInTheDocument();
    expect(screen.getByText(/Changez le port local/i)).toBeInTheDocument();
  });

  it("vérifie un port libre via Tauri (tauriInvoke)", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === "secure_get") return JSON.stringify([makeHost("h1")]);
      if (cmd === "check_port") return true;
      return null;
    });
    await renderManager();

    fireEvent.click(screen.getByText("Tester le Port"));

    await waitFor(() => {
      expect(tauriInvoke).toHaveBeenCalledWith("check_port", { port: 8080 });
    });
    await waitFor(() => {
      expect(screen.getByText(/Le port local 8080 est libre et prêt/i)).toBeInTheDocument();
    });
  });

  it("vérifie un port occupé via Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === "secure_get") return JSON.stringify([makeHost("h1")]);
      if (cmd === "check_port") return false;
      return null;
    });
    await renderManager();

    fireEvent.click(screen.getByText("Tester le Port"));

    await waitFor(() => {
      expect(screen.getByText(/Le port local 8080 est OCCUPÉ/i)).toBeInTheDocument();
    });
  });

  it("affiche une erreur de diagnostic quand l'API est indisponible", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API down"));
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { localPort: 9090 })])
    );

    await renderManager();

    fireEvent.click(screen.getByTitle("Lancer le diagnostic réseau"));

    await waitFor(() => {
      expect(screen.getByText(/\[ERREUR\] Impossible de vérifier le port 9090/i)).toBeInTheDocument();
    });
  });

  it("diagnostic : port local occupé côté web", async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ available: false }),
    });
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { localPort: 9090 })])
    );

    await renderManager();

    fireEvent.click(screen.getByTitle("Lancer le diagnostic réseau"));

    await waitFor(() => {
      expect(screen.getByText(/Port local 9090: OCCUPÉ/i)).toBeInTheDocument();
    });
  });

  it("diagnostic : port libre via Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
      if (cmd === "secure_get") return JSON.stringify([makeHost("h1")]);
      if (cmd === "check_port") return true;
      return null;
    });
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([makeTunnel("t1", { localPort: 9090 })])
    );

    await renderManager();

    fireEvent.click(screen.getByTitle("Lancer le diagnostic réseau"));

    await waitFor(() => {
      expect(tauriInvoke).toHaveBeenCalledWith("check_port", { port: 9090 });
    });
    await waitFor(() => {
      expect(screen.getByText(/Port local 9090: LIBRE/i)).toBeInTheDocument();
    });
  });

  it("filtre les tunnels par type (remote)", async () => {
    window.localStorage.setItem(
      TUNNELS_KEY,
      JSON.stringify([
        makeTunnel("t1", { name: "Local MySQL", localPort: 3306 }),
        makeTunnel("t2", { name: "Remote Web", type: "remote", localPort: 8080, remoteHost: "localhost", remotePort: 80 }),
      ])
    );

    await renderManager();

    fireEvent.click(screen.getByRole("button", { name: "REMOTE" }));

    expect(screen.getByText("Remote Web")).toBeInTheDocument();
    expect(screen.queryByText("Local MySQL")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LOCAL" }));

    expect(screen.getByText("Local MySQL")).toBeInTheDocument();
    expect(screen.queryByText("Remote Web")).not.toBeInTheDocument();
  });

  it("ferme le modal de création via Annuler", async () => {
    await renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Créer un Tunnel SSH/i }));
    expect(screen.getByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByText(/Nouveau Tunnel SSH \/ Port Forwarding/i)).not.toBeInTheDocument();
  });
});
