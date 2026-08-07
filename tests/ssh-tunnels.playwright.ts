import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// ============================================================================
// Tests e2e — vues « Tunnels & Reverse Proxy » et « Maintenance Système ».
//
// Contexte :
//  - Projet Playwright « chromium » (baseURL http://localhost:3000, sans auth).
//  - Les composants stockent leurs données dans localStorage (stockage web
//    documenté : clair, sans fausse obfuscation — voir lib/secureStorage.ts).
//    Chaque test démarre avec un contexte navigateur vierge => isolation.
//  - Un hôte SSH est un prérequis du formulaire de tunnel : il est injecté en
//    localStorage (préfixe e2e-) avant le chargement de l'app.
// ============================================================================

/** Hôte SSH de prérequis (injecté en localStorage, stockage web documenté). */
const HOTE_E2E = {
  id: "e2e-host-1",
  name: "e2e-hôte-demo",
  host: "e2e.example.com",
  port: 22,
  username: "e2e-user",
  authType: "key",
  privateKeyPath: "~/.ssh/id_rsa",
  category: "e2e",
  color: "#10b981",
  description: "Hôte de test e2e",
  tunnels: [],
  quickCommands: [],
};

/** Injecte l'hôte SSH dans localStorage avant le chargement de l'application. */
async function seedHoteE2e(page: Page) {
  await page.addInitScript((hote) => {
    localStorage.setItem("terminal_ssh_hosts", JSON.stringify([hote]));
  }, HOTE_E2E);
}

/** Ouvre la vue « Tunnels & Reverse Proxy » via la Sidebar (libellé exact). */
async function ouvrirVueTunnels(page: Page) {
  await page.goto("/");
  await page.getByText("Tunnels & Reverse Proxy").first().click();
  await expect(
    page.getByText("Générateur & Testeur de Tunnels SSH / Reverse Proxy")
  ).toBeVisible();
}

/** Ouvre la vue « Maintenance Système » via la Sidebar (libellé exact). */
async function ouvrirVueMaintenance(page: Page) {
  await page.goto("/");
  await page.getByText("Maintenance Système").first().click();
  await expect(page.getByText("Centre de Maintenance Linux Avancé")).toBeVisible();
}

/**
 * Crée un tunnel SSH via le formulaire modal (« Créer un Tunnel SSH »).
 * L'hôte seedé est sélectionné explicitement (selectOption attend l'option,
 * ce qui couvre le chargement asynchrone du stockage).
 */
async function creerTunnel(
  page: Page,
  nom: string,
  portLocal: number,
  hoteDistant: string
) {
  await page.getByRole("button", { name: "Créer un Tunnel SSH" }).click();
  await expect(page.getByText("Nouveau Tunnel SSH / Port Forwarding")).toBeVisible();

  await page.getByPlaceholder("Ex: Redirection PostgreSQL").fill(nom);
  await page.getByRole("combobox").first().selectOption("e2e-host-1");
  await page.locator('input[type="number"]').first().fill(String(portLocal));
  await page.getByPlaceholder("localhost ou 127.0.0.1").fill(hoteDistant);
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Le tunnel apparaît dans la liste (carte avec son nom exact)
  await expect(page.getByText(nom, { exact: true })).toBeVisible();
}

test.describe("Tunnels & Reverse Proxy", () => {
  test("crée un tunnel SSH via le formulaire et l'affiche dans la liste", async ({ page }) => {
    await seedHoteE2e(page);
    await ouvrirVueTunnels(page);

    const nom = "e2e-tunnel-postgres";
    const portLocal = 23456;
    const hoteDistant = "db.internal";

    await creerTunnel(page, nom, portLocal, hoteDistant);

    // La carte affiche la configuration réelle saisie dans le formulaire
    const carte = page.locator("div.rounded-xl", { hasText: nom }).first();
    await expect(carte.getByText("local", { exact: true })).toBeVisible(); // badge type
    await expect(carte.getByText("e2e-hôte-demo")).toBeVisible(); // Serveur SSH
    await expect(carte.getByText(String(portLocal))).toBeVisible(); // Forward local
    await expect(carte.getByText(`${hoteDistant}:80`)).toBeVisible(); // Cible distante
    await expect(carte.getByText(/KeepAlive: 60s/)).toBeVisible();
    await expect(carte.getByText("ExitOnFail: Oui")).toBeVisible();
  });

  test("exporte les tunnels en JSON (téléchargement réel)", async ({ page }) => {
    await seedHoteE2e(page);
    await ouvrirVueTunnels(page);

    const nom = "e2e-tunnel-export";
    await creerTunnel(page, nom, 34567, "export.internal");

    // Le bouton Exporter déclenche un vrai téléchargement de fichier
    const telechargementPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByRole("button", { name: "Exporter" }).click();
    const telechargement = await telechargementPromise;

    expect(telechargement.suggestedFilename()).toMatch(
      /^tunnels_ssh_\d{4}-\d{2}-\d{2}\.json$/
    );

    // Le contenu exporté contient réellement le tunnel créé
    const contenu = readFileSync(await telechargement.path(), "utf-8");
    expect(contenu).toContain(nom);
    expect(contenu).toContain("e2e-host-1");
  });

  test("affiche un état honnête sans métriques de trafic inventées", async ({ page }) => {
    await seedHoteE2e(page);
    await ouvrirVueTunnels(page);

    const nom = "e2e-tunnel-honnete";
    const portLocal = 45678;
    const hoteDistant = "proxy.internal";

    await creerTunnel(page, nom, portLocal, hoteDistant);

    const carte = page.locator("div.rounded-xl", { hasText: nom }).first();

    // Tunnel inactif : message honnête, aucune fausse métrique Tx/Rx
    await expect(
      carte.getByText(
        "Lancez la commande du tunnel dans le terminal pour l'activer (aucune mesure de trafic locale)."
      )
    ).toBeVisible();
    await expect(page.getByText(/Mbps|Kbps|Mo\/s|Ko\/s/i)).toHaveCount(0);

    // Activation : la commande SSH réelle part vers le terminal (écriture PTY 200)
    const ecriture = page.waitForResponse(
      (res) =>
        res.url().includes("/api/pty/") &&
        res.url().endsWith("/write") &&
        res.request().method() === "POST",
      { timeout: 15_000 }
    );
    await carte.getByRole("button", { name: "Exécuter Terminal" }).click();
    const reponse = await ecriture;
    expect(reponse.ok()).toBeTruthy();
    expect(reponse.request().postData()).toContain("ssh -N");
    expect(reponse.request().postData()).toContain(`-L ${portLocal}:${hoteDistant}:80`);

    // La vue bascule vers le terminal (flux réel) puis retour aux tunnels
    await expect(page.getByText("Explorateur CWD")).toBeVisible();
    await page.getByText("Tunnels & Reverse Proxy").first().click();

    // Le tunnel reste inactif (statut non modifié par l'exécution) :
    // le message honnête est toujours affiché
    const carteRetour = page.locator("div.rounded-xl", { hasText: nom }).first();
    await expect(
      carteRetour.getByText(
        "Lancez la commande du tunnel dans le terminal pour l'activer (aucune mesure de trafic locale)."
      )
    ).toBeVisible();
  });

  test("un tunnel marqué actif affiche un état honnête (aucune métrique)", async ({
    page,
  }) => {
    // Tunnel seedé avec statut actif (l'UI ne permet pas de basculer vers
    // actif : le toggle n'est exposé que sur un tunnel déjà actif)
    await page.addInitScript((hote) => {
      localStorage.setItem("terminal_ssh_hosts", JSON.stringify([hote]));
      localStorage.setItem(
        "terminal_ssh_tunnels",
        JSON.stringify([
          {
            id: "e2e-tunnel-actif",
            name: "e2e-tunnel-actif",
            hostId: "e2e-host-1",
            type: "local",
            localPort: 56789,
            remoteHost: "proxy.internal",
            remotePort: 443,
            status: "active",
            serverAliveInterval: 60,
            exitOnFailure: true,
          },
        ])
      );
    }, HOTE_E2E);

    await ouvrirVueTunnels(page);

    const carte = page.locator("div.rounded-xl", { hasText: "e2e-tunnel-actif" }).first();

    // Marqué actif, mais AUCUNE mesure inventée : état honnête explicite
    await expect(carte.getByText("Marqué actif")).toBeVisible();
    await expect(
      carte.getByText("Aucune mesure de trafic locale (diagnostic : vérifie le port réellement)")
    ).toBeVisible();
    await expect(page.getByText(/Mbps|Kbps|Mo\/s|Ko\/s/i)).toHaveCount(0);
  });
});

test.describe("Maintenance Système", () => {
  test("affiche les tâches de maintenance et les raccourcis par défaut", async ({ page }) => {
    await ouvrirVueMaintenance(page);

    // En-tête et sélecteur de session cible
    await expect(page.getByText("Session cible :")).toBeVisible();
    await expect(page.getByRole("combobox").first()).toBeVisible();

    // Tâches de maintenance (source : MAINTENANCE_TASKS)
    await expect(page.getByText("Mise à jour du système (APT)")).toBeVisible();
    await expect(page.getByText("Purge des fichiers de journaux (Logs)")).toBeVisible();
    await expect(page.getByText("Analyse d'occupation disque")).toBeVisible();
    await expect(page.getByText("Libération du cache mémoire Linux")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Exécuter la tâche" }).first()
    ).toBeVisible();

    // Contrôleur de services Linux
    await expect(page.getByText("Contrôleur de Services Linux")).toBeVisible();
    await expect(page.getByRole("button", { name: "docker" })).toBeVisible();

    // Raccourcis enregistrés par défaut
    await expect(page.getByText("Raccourcis Enregistrés")).toBeVisible();
    await expect(page.getByText("Intégrité Globale Système")).toBeVisible();
    await expect(page.getByText("Nettoyage du cache DNS")).toBeVisible();
  });

  test("exécute une tâche sûre et confirme l'envoi au terminal", async ({ page }) => {
    await ouvrirVueMaintenance(page);

    // Tâche « Analyse d'occupation disque » (commande en lecture seule : df / du)
    const carte = page
      .locator("div.rounded-xl", { hasText: "Analyse d'occupation disque" })
      .first();
    await expect(carte.getByText("df -h && du -sh", { exact: false })).toBeVisible();

    // Le clic envoie réellement la commande au PTY (écriture POST /api/pty/:id/write)
    const ecriture = page.waitForResponse(
      (res) =>
        res.url().includes("/api/pty/") &&
        res.url().endsWith("/write") &&
        res.request().method() === "POST"
    );
    await carte.getByRole("button", { name: "Exécuter la tâche" }).click();
    const reponse = await ecriture;
    expect(reponse.ok()).toBeTruthy();
    expect(reponse.request().postData()).toContain("df -h");

    // Retour visuel : la vue bascule vers le terminal (barre d'outils PTY)
    await expect(page.getByText("Explorateur CWD")).toBeVisible();
  });

  test("crée un raccourci de maintenance puis l'exécute", async ({ page }) => {
    await ouvrirVueMaintenance(page);

    const titre = "e2e-macro-inventaire";
    const commande = "echo e2e-macro-inventaire-ok";

    // Formulaire « Nouveau Raccourci de Maintenance »
    await page.getByPlaceholder("Nom").fill(titre);
    await page.getByPlaceholder("Commande (ex: free -m)").fill(commande);
    await page.getByRole("button", { name: "Ajouter le Raccourci" }).click();

    // Le raccourci apparaît dans la liste persistante (« Raccourcis Enregistrés »)
    const ligne = page.locator("div.bg-slate-950", { hasText: titre }).first();
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText(commande, { exact: false })).toBeVisible();

    // Exécution : la commande part réellement vers le terminal (écriture PTY 200)
    const ecriture = page.waitForResponse(
      (res) =>
        res.url().includes("/api/pty/") &&
        res.url().endsWith("/write") &&
        res.request().method() === "POST",
      { timeout: 15_000 }
    );
    await page.getByRole("button", { name: `Exécuter ${titre}` }).click();
    const reponse = await ecriture;
    expect(reponse.ok()).toBeTruthy();
    expect(reponse.request().postData()).toContain(commande);

    // Retour visuel : bascule vers la vue terminal
    await expect(page.getByText("Explorateur CWD")).toBeVisible();
  });
});
