import { test, expect, Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Tests e2e des vues : Skills / Fonctions, Bibliothèque Snippets,
// Raccourcis Web & Services et Surveillance des Ressources (Ressources
// Système dans la Sidebar).
//
// Conventions :
//  - Navigation par libellé EXACT de la Sidebar (src/components/Sidebar.tsx).
//  - Données créées préfixées "e2e-" (localStorage isolé par contexte de test).
//  - L'exécution d'une commande (skill / snippet / raccourci cURL) est
//    vérifiée de façon déterministe en interceptant le POST /api/pty/:id/write
//    (le rendu xterm peut être canvas, non lisible en DOM).
// ─────────────────────────────────────────────────────────────────────────────

// Ouvre l'app et attend que la Sidebar soit prête.
async function gotoApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Skills / Fonctions" })).toBeVisible({
    timeout: 15_000,
  });
}

// Navigue vers une vue de la Sidebar par libellé exact.
async function openView(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

// NB : les exécutions PTY réelles (POST /api/pty/:id/write) sont couvertes
// par ssh-tunnels.playwright.ts — ce fichier vérifie les flux UI des vues.

test.describe("Vue Skills / Fonctions", () => {
  test("affiche les compétences par défaut et exécute une compétence dans le terminal", async ({
    page,
  }) => {
    await gotoApp(page);
    await openView(page, "Skills / Fonctions");

    // En-tête de la vue
    await expect(
      page.getByRole("heading", { name: /Super-Compétences & Fonctions d'Automatisation/ })
    ).toBeVisible({ timeout: 10_000 });

    // Les 4 compétences prédéfinies sont listées dans la bibliothèque
    // (données réelles issues de PREDEFINED_SKILLS dans SkillsHub.tsx)
    const bibliotheque = page.getByText("BIBLIOTHÈQUE DE COMPÉTENCES");
    await expect(bibliotheque).toBeVisible();
    await expect(page.getByRole("button", { name: /Scanner de Ports Réseau/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Analyseur de Logs Avancé/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Générateur de Charge CPU \/ IO/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nettoyeur de Conteneurs Docker/ })).toBeVisible();

    // La compétence active par défaut est "Scanner de Ports Réseau"
    await expect(
      page.getByRole("heading", { name: "Scanner de Ports Réseau" })
    ).toBeVisible();
    await expect(page.getByPlaceholder("Filtrer les compétences...")).toBeVisible();

    // Exécution : la commande compilée part réellement vers le PTY actif
    const writePromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        /\/api\/pty\/[^/]+\/write$/.test(new URL(req.url()).pathname),
      { timeout: 20_000 }
    );
    await page.getByRole("button", { name: "Exécuter la Compétence" }).click();
    const writeReq = await writePromise;
    const payload = writeReq.postDataJSON() as { data?: string } | null;
    expect(payload?.data).toContain("Lancement du scan de ports sur 127.0.0.1");
    expect(payload?.data).toContain("nc -zv -w 2 127.0.0.1 22 80 443 3000");

    // La vue bascule automatiquement sur le terminal (barre de commande visible)
    await expect(
      page.getByPlaceholder(/Saisissez ou choisissez une commande/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("ouvre le créateur de compétence et valide le formulaire", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Skills / Fonctions");

    await page.getByRole("button", { name: "Créer une Compétence" }).click();

    // Formulaire du créateur (SkillCreatorPanel.tsx)
    await expect(
      page.getByRole("heading", { name: "Créateur de Compétence Personnalisée" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Titre de la compétence")).toBeVisible();
    await expect(page.getByText("Catégorie", { exact: true })).toBeVisible();
    await expect(page.getByText("Description", { exact: true })).toBeVisible();
    await expect(page.getByText("Modèle de Script Bash/Shell")).toBeVisible();
    await expect(page.getByText("DÉFINITION DES VARIABLES DE FORMULAIRE")).toBeVisible();

    // Bouton d'enregistrement désactivé tant que titre + script sont vides
    const saveButton = page.getByRole("button", { name: "Enregistrer & Publier la Compétence" });
    await expect(saveButton).toBeDisabled();

    // Remplissage minimal → le bouton devient actif (validation réelle du formulaire)
    await page.getByPlaceholder("e.g., Déployeur Git Express").fill("e2e- compétence test");
    await page
      .getByPlaceholder(/git checkout/)
      .fill("echo 'e2e-skill-ok'");
    await expect(saveButton).toBeEnabled();
  });
});

test.describe("Vue Bibliothèque Snippets", () => {
  test("affiche les snippets par défaut et exécute un snippet dans le terminal", async ({
    page,
  }) => {
    await gotoApp(page);
    await openView(page, "Bibliothèque Snippets");

    // En-tête + compteur (6 snippets prédéfinis dans COMMAND_SNIPPETS)
    await expect(
      page.getByRole("heading", { name: /Bibliothèque de Snippets Shell Linux/ })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Snippets Disponibles (6)")).toBeVisible();

    // Les 6 snippets par défaut sont présents
    for (const titre of [
      "Infos Système Détaillées",
      "Ports Réseau Écoute",
      "Statut Git Résumé",
      "Trouver les Gros Fichiers (>100M)",
      "Conteneurs Docker Actifs",
      "Suivi Réseau et Connexions",
    ]) {
      await expect(page.getByRole("heading", { name: titre })).toBeVisible();
    }

    // Catégories filtrables + recherche
    await expect(page.getByRole("button", { name: "Perso / Customs" })).toBeVisible();
    await expect(page.getByPlaceholder("Filtrer les snippets...")).toBeVisible();

    // Exécution du premier snippet ("Infos Système Détaillées") → commande PTY
    const writePromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        /\/api\/pty\/[^/]+\/write$/.test(new URL(req.url()).pathname),
      { timeout: 20_000 }
    );
    await page.getByRole("button", { name: "Exécuter dans le Terminal" }).first().click();
    const writeReq = await writePromise;
    const payload = writeReq.postDataJSON() as { data?: string } | null;
    expect(payload?.data).toContain("uname -a");

    // La vue bascule sur le terminal
    await expect(
      page.getByPlaceholder(/Saisissez ou choisissez une commande/)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("crée un snippet personnalisé (préfixe e2e-)", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Bibliothèque Snippets");

    // Formulaire "Créateur de Snippets" (SnippetsLibrary.tsx)
    await expect(page.getByText("Créateur de Snippets")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("ex: Nettoyage logs systemd").fill("e2e- snippet test");
    await page.getByPlaceholder("ex: Docker, Git").fill("e2e");
    await page.getByPlaceholder("ex: Libère de la place").fill("Snippet créé par les tests e2e");
    await page.getByPlaceholder("ex: journalctl --vacuum-time=7d").fill("echo 'e2e-snippet-ok'");

    await page.getByRole("button", { name: "Enregistrer le Snippet" }).click();

    // Le snippet apparaît dans la grille avec le badge "Custom"
    await expect(
      page.getByRole("heading", { name: "e2e- snippet test" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("echo 'e2e-snippet-ok'").first()).toBeVisible();
    await expect(page.getByText("Custom", { exact: true })).toBeVisible();

    // Le compteur passe à 7 snippets
    await expect(page.getByText("Snippets Disponibles (7)")).toBeVisible();
  });
});

test.describe("Vue Raccourcis Web & Services", () => {
  test("affiche les raccourcis par défaut et exporte la liste en JSON", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Raccourcis Web");

    // En-tête de la vue (le libellé interne est "Raccourcis Web & Services")
    const header = page.getByRole("heading", { name: /Raccourcis Web & Services/ });
    await expect(header).toBeVisible({ timeout: 10_000 });
    await expect(header).toContainText("7 enregistrés");

    // Les 7 raccourcis par défaut (DEFAULT_SHORTCUTS dans WebShortcutsManager.tsx)
    for (const titre of [
      "GitHub Repository",
      "Documentation Rust",
      "Grafana Local Dashboard",
      "Portainer UI (Localhost:9000)",
      "Tailwind CSS Documentation",
      "Docker Hub Registry",
      "Stack Overflow",
    ]) {
      await expect(page.getByRole("heading", { name: titre })).toBeVisible();
    }

    // Recherche + boutons d'action
    await expect(page.getByPlaceholder("Rechercher par titre, URL ou tag...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nouveau Raccourci" })).toBeVisible();

    // Export réel : téléchargement du fichier raccourcis_web_AAAA-MM-JJ.json
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByRole("button", { name: "Exporter" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^raccourcis_web_\d{4}-\d{2}-\d{2}\.json$/);
  });

  test("crée un raccourci en mode cURL et l'ouvre dans le terminal", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Raccourcis Web");

    // Ouverture du modal de création
    await page.getByRole("button", { name: "Nouveau Raccourci" }).click();
    await expect(
      page.getByRole("heading", { name: "Nouveau Raccourci Web" })
    ).toBeVisible({ timeout: 10_000 });

    // Remplissage du formulaire (WebShortcutFormModal.tsx)
    await page.getByPlaceholder("ex: Portainer, GitHub, Grafana...").fill("e2e- raccourci curl");
    await page.getByPlaceholder("https://github.com ou http://localhost:8080").fill("http://e2e.example.test:8080");
    await page.getByPlaceholder("Brève description de l'application ou du service...").fill("Raccourci créé par les tests e2e");
    await page.getByPlaceholder("Dev, Monitoring, Docs...").fill("e2e");
    await page.getByPlaceholder("docker, metrics, rust, api").fill("e2e, test");

    // Mode d'ouverture → "Exécuter cURL au Terminal" (valeur curl_terminal)
    await page.getByRole("combobox").selectOption("curl_terminal");

    await page.getByRole("button", { name: "Créer le Raccourci" }).click();

    // Notification de succès + carte visible
    await expect(page.getByText("Nouveau raccourci web créé.")).toBeVisible({ timeout: 10_000 });
    const card = page
      .locator("div.group")
      .filter({ has: page.getByRole("heading", { name: "e2e- raccourci curl" }) });
    await expect(card).toBeVisible();

    // Ouverture en mode terminal → commande curl injectée dans le PTY
    const writePromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        /\/api\/pty\/[^/]+\/write$/.test(new URL(req.url()).pathname),
      { timeout: 20_000 }
    );
    await card.getByRole("button", { name: "Ouvrir" }).click();
    const writeReq = await writePromise;
    const payload = writeReq.postDataJSON() as { data?: string } | null;
    expect(payload?.data).toContain('curl -i -L "http://e2e.example.test:8080"');

    // La vue bascule sur le terminal
    await expect(
      page.getByPlaceholder(/Saisissez ou choisissez une commande/)
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Vue Surveillance des Ressources (Ressources Système)", () => {
  test("affiche la vue globale et bascule entre les onglets", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Ressources Système");

    // En-tête de la vue
    await expect(
      page.getByRole("heading", { name: /Centre de Télémétries & Ressources Système/ })
    ).toBeVisible({ timeout: 15_000 });

    // Les 5 onglets sont présents (SystemMonitorModal.tsx)
    await expect(page.getByRole("button", { name: "Vue Globale" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Réseau & IPs/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Node.js & Memory" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Matériel & Coeurs/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Processus TOP/ })).toBeVisible();

    // Vue globale : libellés des cartes de ressources (valeurs réelles non
    // assertées — { exact: true } évite les sous-chaînes dupliquées comme
    // "TENDANCE PROCESSEUR" ou la description du header)
    await expect(page.getByText("PROCESSEUR", { exact: true })).toBeVisible();
    await expect(page.getByText("MÉMOIRE RAM", { exact: true })).toBeVisible();
    await expect(page.getByText("ESPACE DISQUE", { exact: true })).toBeVisible();
    await expect(page.getByText("NOYAU & SYSTÈME", { exact: true })).toBeVisible();

    // Onglet Réseau
    await page.getByRole("button", { name: /Réseau & IPs/ }).click();
    await expect(page.getByText("Interfaces Réseau Détectées")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Filtrer par IP ou interface...")).toBeVisible();

    // Onglet Node.js
    await page.getByRole("button", { name: "Node.js & Memory" }).click();
    await expect(page.getByText("Node.js Environment")).toBeVisible({ timeout: 10_000 });

    // Onglet Matériel
    await page.getByRole("button", { name: /Matériel & Coeurs/ }).click();
    await expect(page.getByText("Détail des Cœurs de Processeur")).toBeVisible({
      timeout: 10_000,
    });

    // Onglet Processus (table TOP avec recherche)
    await page.getByRole("button", { name: /Processus TOP/ }).click();
    await expect(page.getByText("Gestionnaire de Processus (TOP)")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByPlaceholder("Filtrer par PID, nom ou utilisateur...")).toBeVisible();
  });

  test("filtre les processus via la recherche", async ({ page }) => {
    await gotoApp(page);
    await openView(page, "Ressources Système");

    // La table des processus est visible dès la vue globale
    const searchInput = page.getByPlaceholder("Filtrer par PID, nom ou utilisateur...");
    await expect(searchInput).toBeVisible({ timeout: 15_000 });

    // Une recherche sans résultat affiche l'état vide honnête
    await searchInput.fill("e2e-introuvable");
    await expect(page.getByText(/Aucun processus ne correspond à votre filtre/)).toBeVisible({
      timeout: 10_000,
    });

    // Une recherche sur un nom de processus réel conserve au moins la ligne concernée
    await searchInput.fill("");
    const firstRowName = page.locator("tbody tr").first().locator("td").nth(1);
    await expect(firstRowName).toBeVisible({ timeout: 10_000 });
    const processName = (await firstRowName.textContent())?.trim() ?? "";
    expect(processName.length).toBeGreaterThan(0);

    await searchInput.fill(processName);
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 10_000 });
    // La ligne filtrée contient bien le nom recherché
    await expect(page.locator("tbody tr").first()).toContainText(processName);
  });
});
