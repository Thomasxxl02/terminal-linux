import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebShortcutsManager } from "../components/WebShortcutsManager";
import { WebShortcut } from "../types";

const STORAGE_KEY = "terminal_studio_web_shortcuts";

const makeShortcut = (overrides: Partial<WebShortcut> & { id: string }): WebShortcut => ({
  title: "Titre par défaut",
  url: "https://example.com",
  description: "",
  category: "Dev",
  color: "sky",
  tags: [],
  isFavorite: false,
  openMode: "new_tab",
  createdAt: Date.now(),
  ...overrides,
});

describe("WebShortcutsManager Component", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders default shortcuts correctly", () => {
    render(<WebShortcutsManager />);

    expect(screen.getByText("Raccourcis Web & Services")).toBeInTheDocument();
    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Documentation Rust")).toBeInTheDocument();
  });

  it("filters shortcuts using the search bar", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "Grafana" } });

    expect(screen.getByText("Grafana Local Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();
  });

  it("shows the empty state when the search has no result", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "zzz-inexistant" } });

    expect(screen.getByText("Aucun raccourci web trouvé")).toBeInTheDocument();
    expect(screen.getByText(/Aucun résultat pour la recherche/i)).toBeInTheDocument();
  });

  it("opens modal and creates a new web shortcut", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    const newBtn = screen.getByText("Nouveau Raccourci");
    fireEvent.click(newBtn);

    expect(screen.getByText("Nouveau Raccourci Web")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    const urlInput = screen.getByPlaceholderText("https://github.com ou http://localhost:8080");

    fireEvent.change(titleInput, { target: { value: "Nginx Admin" } });
    fireEvent.change(urlInput, { target: { value: "http://localhost:8080" } });

    const submitBtn = screen.getByText("Créer le Raccourci");
    fireEvent.click(submitBtn);

    expect(screen.getByText("Nginx Admin")).toBeInTheDocument();
    // Notification de création affichée puis effacée après le délai
    expect(screen.getByText("Nouveau raccourci web créé.")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Nouveau raccourci web créé.")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("edits an existing shortcut via the edit button", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Éditer GitHub Repository/i }));

    // Le modal d'édition est pré-rempli
    expect(screen.getByText("Modifier le Raccourci Web")).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    expect(titleInput).toHaveValue("GitHub Repository");
  });

  it("saves an edited shortcut and persists the update", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Éditer GitHub Repository/i }));
    const titleInput = screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana...");
    fireEvent.change(titleInput, { target: { value: "GitHub Entreprise" } });
    fireEvent.click(screen.getByText("Enregistrer"));

    expect(screen.getByText("GitHub Entreprise")).toBeInTheDocument();
    expect(screen.getByText("Raccourci mis à jour avec succès.")).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as WebShortcut[];
    expect(stored.find((s) => s.id === "sc-1")?.title).toBe("GitHub Entreprise");

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("deletes a shortcut after confirmation", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Supprimer Documentation Rust/i }));

    expect(screen.getByText("Supprimer le Raccourci Web ?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Supprimer"));

    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("opens the embedded preview for shortcuts in embedded mode", () => {
    render(<WebShortcutsManager />);

    // Grafana Local Dashboard est en mode embedded : trouver le bouton
    // "Ouvrir" DANS sa carte
    const grafanaCard = screen.getByText("Grafana Local Dashboard").closest("div[class*='rounded']");
    expect(grafanaCard).not.toBeNull();
    const openButton = within(grafanaCard as HTMLElement).getByText("Ouvrir");
    fireEvent.click(openButton);

    // Le preview plein écran apparaît
    expect(screen.getByTitle("Fermer l'aperçu")).toBeInTheDocument();
    expect(screen.getByTitle("Rafraîchir")).toBeInTheDocument();
  });

  it("opens a shortcut in a new tab when in new_tab mode", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<WebShortcutsManager />);

    // GitHub Repository est en mode new_tab
    const openButtons = screen.getAllByText("Ouvrir");
    fireEvent.click(openButtons[0]);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://github.com",
      "_blank",
      "noopener,noreferrer"
    );
    windowOpenSpy.mockRestore();
  });

  it("triggers terminal execute command when testing cURL", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const handleExecuteInTerminal = vi.fn();
    render(<WebShortcutsManager onExecuteInTerminal={handleExecuteInTerminal} />);

    const curlButtons = screen.getAllByTitle("Envoyer commande cURL au terminal");
    if (curlButtons.length > 0) {
      fireEvent.click(curlButtons[0]);
      expect(handleExecuteInTerminal).toHaveBeenCalledWith(expect.stringContaining("curl -I"));
    }
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  // ── Nouveaux tests : branches non couvertes ──────────────────────────

  it("bascule un raccourci en favori puis retire le favori", () => {
    render(<WebShortcutsManager />);

    // sc-4 (Portainer) n'est pas favori au départ
    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter aux favoris" })[0]);

    let stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as WebShortcut[];
    expect(stored.find((s) => s.id === "sc-4")?.isFavorite).toBe(true);

    // sc-1 (GitHub) est favori : le retirer
    fireEvent.click(screen.getAllByRole("button", { name: "Retirer des favoris" })[0]);

    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string) as WebShortcut[];
    expect(stored.find((s) => s.id === "sc-1")?.isFavorite).toBe(false);
  });

  it("copie l'URL d'un raccourci dans le presse-papiers", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const writeSpy = vi.spyOn(navigator.clipboard, "writeText");
    render(<WebShortcutsManager />);

    const copyButtons = screen.getAllByRole("button", { name: "Copier l'adresse URL" });
    fireEvent.click(copyButtons[0]);

    expect(writeSpy).toHaveBeenCalledWith("https://github.com");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    vi.useRealTimers();
  });

  it("lance un raccourci en mode curl_terminal via le terminal", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const handleExecuteInTerminal = vi.fn();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeShortcut({
          id: "c1",
          title: "API Locale",
          url: "http://localhost:9999/api",
          openMode: "curl_terminal",
        }),
      ])
    );

    render(<WebShortcutsManager onExecuteInTerminal={handleExecuteInTerminal} />);

    fireEvent.click(screen.getByText("Ouvrir"));

    expect(handleExecuteInTerminal).toHaveBeenCalledWith('curl -i -L "http://localhost:9999/api"');
    expect(screen.getByText(/Requête cURL envoyée vers http:\/\/localhost:9999\/api/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("curl_terminal sans onExecuteInTerminal retombe sur window.open", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeShortcut({
          id: "c1",
          title: "API Locale",
          url: "http://localhost:9999/api",
          openMode: "curl_terminal",
        }),
      ])
    );

    render(<WebShortcutsManager />);
    fireEvent.click(screen.getByText("Ouvrir"));

    expect(windowOpenSpy).toHaveBeenCalledWith("http://localhost:9999/api", "_blank", "noopener,noreferrer");
    windowOpenSpy.mockRestore();
  });

  it("exporte les raccourcis en JSON via un lien de téléchargement", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let capturedHref = "";
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node: Node) => {
        const a = node as HTMLAnchorElement;
        capturedHref = a.getAttribute("href") ?? "";
        return node;
      });

    fireEvent.click(screen.getByText("Exporter"));

    expect(clickSpy).toHaveBeenCalled();
    expect(decodeURIComponent(capturedHref)).toContain('"title": "GitHub Repository"');
    expect(screen.getByText("Raccourcis exportés en JSON.")).toBeInTheDocument();
    appendSpy.mockRestore();
    clickSpy.mockRestore();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("importe un tableau JSON valide de raccourcis", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Importer"));
    expect(screen.getByText("Importer des Raccourcis (Format JSON)")).toBeInTheDocument();

    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          makeShortcut({ id: "imp1", title: "Raccourci Importé A", url: "https://a.test" }),
          makeShortcut({ id: "imp2", title: "Raccourci Importé B", url: "https://b.test" }),
        ]),
      },
    });
    fireEvent.click(screen.getByText("Valider l'import"));

    expect(screen.getByText("Raccourci Importé A")).toBeInTheDocument();
    expect(screen.getByText("Raccourci Importé B")).toBeInTheDocument();
    expect(screen.queryByText("GitHub Repository")).not.toBeInTheDocument();
    expect(screen.getByText("2 raccourcis importés avec succès.")).toBeInTheDocument();
    // Le modal d'import est fermé
    expect(screen.queryByText("Importer des Raccourcis (Format JSON)")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("affiche une alerte quand le JSON importé est invalide", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Importer"));
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "pas du json valide" } });
    fireEvent.click(screen.getByText("Valider l'import"));

    expect(alertSpy).toHaveBeenCalledWith("Erreur de parsing JSON. Vérifiez votre syntaxe.");
    alertSpy.mockRestore();
  });

  it("affiche une alerte quand le JSON importé n'est pas un tableau", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Importer"));
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"objet": true}' } });
    fireEvent.click(screen.getByText("Valider l'import"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Format JSON invalide. Doit être un tableau de raccourcis."
    );
    alertSpy.mockRestore();
  });

  it("ferme le bandeau de notification via son bouton", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Nouveau Raccourci"));
    fireEvent.change(screen.getByPlaceholderText("ex: Portainer, GitHub, Grafana..."), {
      target: { value: "Nginx Admin" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://github.com ou http://localhost:8080"), {
      target: { value: "http://localhost:8080" },
    });
    fireEvent.click(screen.getByText("Créer le Raccourci"));

    expect(screen.getByText("Nouveau raccourci web créé.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("Nouveau raccourci web créé.")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
  });

  it("efface la recherche avec le bouton X", () => {
    render(<WebShortcutsManager />);

    const searchInput = screen.getByPlaceholderText("Rechercher par titre, URL ou tag...");
    fireEvent.change(searchInput, { target: { value: "Grafana" } });
    expect(screen.queryByText("Documentation Rust")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));

    expect(searchInput).toHaveValue("");
    expect(screen.getByText("Documentation Rust")).toBeInTheDocument();
  });

  it("filtre les raccourcis par la catégorie Favoris", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: "★ Favoris" }));

    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.queryByText("Tailwind CSS Documentation")).not.toBeInTheDocument();
    expect(screen.queryByText("Portainer UI (Localhost:9000)")).not.toBeInTheDocument();
  });

  it("filtre les raccourcis par une catégorie spécifique", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: "Docs" }));

    expect(screen.getByText("Documentation Rust")).toBeInTheDocument();
    expect(screen.getByText("Tailwind CSS Documentation")).toBeInTheDocument();
    expect(screen.queryByText("GitHub Repository")).not.toBeInTheDocument();
  });

  it("gère une URL invalide via le fallback getDomainFromUrl", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        makeShortcut({
          id: "bad",
          title: "Raccourci URL Bizarre",
          url: "pas une url valide",
        }),
      ])
    );

    render(<WebShortcutsManager />);
    expect(screen.getByText("Raccourci URL Bizarre")).toBeInTheDocument();
  });

  it("masque le favicon quand son chargement échoue", () => {
    const { container } = render(<WebShortcutsManager />);

    const favicon = container.querySelectorAll("img")[0];
    fireEvent.error(favicon);

    expect((favicon as HTMLImageElement).style.display).toBe("none");
  });

  it("le clic sur le lien URL du raccourci ne déclenche pas d'action", () => {
    render(<WebShortcutsManager />);

    const urlLink = screen.getByRole("link", { name: "https://github.com" });
    fireEvent.click(urlLink);

    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
  });

  it("annule la suppression via la modale de confirmation", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByRole("button", { name: /Supprimer Portainer UI/ }));
    expect(screen.getByText("Supprimer le Raccourci Web ?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Annuler"));

    // Le raccourci est conservé
    expect(screen.getByText("Portainer UI (Localhost:9000)")).toBeInTheDocument();
  });

  it("ferme le modal de création via Annuler", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Nouveau Raccourci"));
    expect(screen.getByText("Nouveau Raccourci Web")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByText("Nouveau Raccourci Web")).not.toBeInTheDocument();
  });

  it("rafraîchit l'aperçu intégré", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<WebShortcutsManager />);

    const grafanaCard = screen.getByText("Grafana Local Dashboard").closest("div[class*='rounded']");
    fireEvent.click(within(grafanaCard as HTMLElement).getByText("Ouvrir"));
    expect(screen.getByTitle("Fermer l'aperçu")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Rafraîchir"));
    // Fermeture + réouverture après 50ms : l'aperçu reste affiché
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTitle("Fermer l'aperçu")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("ferme l'aperçu intégré", () => {
    render(<WebShortcutsManager />);

    const grafanaCard = screen.getByText("Grafana Local Dashboard").closest("div[class*='rounded']");
    fireEvent.click(within(grafanaCard as HTMLElement).getByText("Ouvrir"));
    expect(screen.getByTitle("Fermer l'aperçu")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Fermer l'aperçu"));
    expect(screen.queryByTitle("Fermer l'aperçu")).not.toBeInTheDocument();
  });

  it("annule l'import JSON via le bouton Annuler", () => {
    render(<WebShortcutsManager />);

    fireEvent.click(screen.getByText("Importer"));
    expect(screen.getByText("Importer des Raccourcis (Format JSON)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByText("Importer des Raccourcis (Format JSON)")).not.toBeInTheDocument();
  });
});
