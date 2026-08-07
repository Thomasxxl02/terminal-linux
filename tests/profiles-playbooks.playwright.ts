import { test, expect, Page } from "@playwright/test";

// ============================================================================
// Tests e2e Playwright — vues « Profils & Shells » (ProfileManager) et
// « Automation Playbooks » (PlaybookSequencer).
// Projet « chromium » : serveur Express sans auth (port 3000). L'état
// localStorage est réinitialisé dans beforeEach pour un démarrage
// déterministe, et les données créées sont préfixées « e2e- ».
// ============================================================================

/** Ouvre une vue depuis la barre latérale en cliquant sur son libellé exact. */
async function openView(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

/**
 * Crée une session PTY. L'écran d'accueil (« Ouvrir un nouveau Terminal
 * Linux ») apparaît quand aucune session n'existe ; sinon on utilise le
 * bouton « nouvel onglet » de la barre d'onglets.
 */
async function createPtySession(page: Page): Promise<void> {
  const welcome = page.locator("button:has-text('Ouvrir un nouveau Terminal Linux')");
  const newTab = page.locator("button[title='Ouvrir un nouvel onglet terminal (/bin/bash)']");
  try {
    await welcome.click({ timeout: 5_000 });
  } catch {
    await newTab.click({ timeout: 5_000 });
  }
  await expect(page.locator(".xterm").first()).toBeVisible({ timeout: 20_000 });
}

test.describe("Vue Profils & Shells", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Profils & Shells", exact: true })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("affiche la vue et les 4 profils par défaut", async ({ page }) => {
    await openView(page, "Profils & Shells");

    await expect(
      page.getByText("Gestionnaire de Profils & Environnements Shell").first()
    ).toBeVisible({ timeout: 15_000 });

    // Les profils prédéfinis (ProfileManager.DEFAULT_PROFILES) sont présents
    for (const profil of [
      "Bash Standard (Dev)",
      "Zsh System Admin",
      "Fish Shell Analytics",
      "POSIX Sh Sandbox",
    ]) {
      await expect(page.getByText(profil).first()).toBeVisible();
    }
  });

  test("crée un profil e2e, l'édite puis le supprime", async ({ page }) => {
    await openView(page, "Profils & Shells");
    await expect(
      page.getByText("Gestionnaire de Profils & Environnements Shell").first()
    ).toBeVisible({ timeout: 15_000 });

    // 1. Création via le bouton « Créer un Profil »
    await page.getByRole("button", { name: "Créer un Profil", exact: true }).click();
    await expect(page.getByText("Créer un Nouveau Profil Shell").first()).toBeVisible();
    await page.getByPlaceholder("Ex: Python Data Science").fill("e2e-Profil Test");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();

    // Le profil apparaît dans la grille
    await expect(page.getByText("e2e-Profil Test").first()).toBeVisible({ timeout: 10_000 });

    // 2. Édition du profil (bouton d'édition avec aria-label dédié)
    await page.getByRole("button", { name: "Éditer le profil e2e-Profil Test" }).click();
    await expect(page.getByText("Éditer le Profil Shell").first()).toBeVisible();
    await page.getByPlaceholder("Ex: Python Data Science").fill("e2e-Profil Modifié");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("e2e-Profil Modifié").first()).toBeVisible({ timeout: 10_000 });

    // 3. Suppression avec confirmation
    await page.getByRole("button", { name: "Supprimer le profil e2e-Profil Modifié" }).click();
    await expect(page.getByText("Supprimer le Profil Shell ?").first()).toBeVisible();
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByText("e2e-Profil Modifié")).toHaveCount(0);
  });
});

test.describe("Vue Automation Playbooks", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Automation Playbooks", exact: true })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("affiche la bibliothèque avec les playbooks par défaut", async ({ page }) => {
    await openView(page, "Automation Playbooks");

    await expect(
      page.getByText("Séquenceur de Playbooks & Automation").first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("BIBLIOTHÈQUE DE PLAYBOOKS").first()).toBeVisible();

    // Les 3 playbooks prédéfinis (PRESET_PLAYBOOKS) sont dans la bibliothèque
    for (const playbook of [
      "🚀 Pipeline Build & Déploiement App",
      "🧹 Maintenance Système & Purge Cache",
      "🔒 Audit Sécurité & Inspection Réseau",
    ]) {
      await expect(page.getByText(playbook).first()).toBeVisible();
    }

    // Le premier playbook est sélectionné par défaut → console d'exécution prête
    await expect(page.getByText(/Estimé :/).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "LANCER LE PIPELINE", exact: true })
    ).toBeVisible();
  });

  test("crée un playbook e2e et le retrouve dans la bibliothèque", async ({ page }) => {
    await openView(page, "Automation Playbooks");
    await expect(
      page.getByText("Séquenceur de Playbooks & Automation").first()
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Créer un Playbook", exact: true }).click();
    await expect(page.getByText("Créer un Nouveau Playbook").first()).toBeVisible();
    await page.getByPlaceholder("Ex: Nettoyage et Déploiement").fill("e2e-Playbook Test");
    await page.getByRole("button", { name: "Enregistrer le Playbook", exact: true }).click();

    // Le playbook créé apparaît dans la bibliothèque (et devient sélectionné)
    await expect(page.getByText("e2e-Playbook Test").first()).toBeVisible({ timeout: 10_000 });
  });

  test("exécute un playbook : le séquenceur écrit les commandes dans le terminal", async ({ page }) => {
    // NB RBAC : en mode web SANS auth (projet « chromium »), le middleware
    // requireAuth assigne le rôle « guest », qui n'a pas la permission
    // execute_terminal → les écritures PTY REST renvoient 403 côté serveur
    // (le rendu réel du pipeline avec sortie est couvert par le projet
    // « auth » où l'utilisateur est connecté en admin). On vérifie ici le
    // comportement côté UI : le pipeline démarre, la vue terminal s'ouvre
    // et le séquenceur envoie bien chaque étape au terminal (bannière +
    // commande + marqueur de code de sortie).

    // Une session PTY est requise pour activer le bouton du pipeline
    await createPtySession(page);
    await openView(page, "Automation Playbooks");
    await expect(
      page.getByText("Séquenceur de Playbooks & Automation").first()
    ).toBeVisible({ timeout: 15_000 });

    // Sélection d'un playbook prédéfini rapide (audit sécurité : commandes
    // de lecture non destructives)
    await page.getByText("🔒 Audit Sécurité & Inspection Réseau").first().click();
    await expect(page.getByText(/Estimé :/).first()).toBeVisible();

    // Capturer les requêtes d'écriture PTY émises par le séquenceur
    const ptyWrites: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/pty\/[^/]+\/write$/.test(req.url())) {
        ptyWrites.push(req.postData() || "");
      }
    });

    await page.getByRole("button", { name: "LANCER LE PIPELINE", exact: true }).click();

    // Le séquenceur bascule sur la vue terminal pour montrer l'exécution
    await expect(page.locator(".xterm").first()).toBeVisible({ timeout: 15_000 });

    // Étape 1 (audit sécurité) : bannière [PLAYBOOK PIPELINE] + commande
    // « uname -a && uptime » + marqueur de code de sortie __PB_EXIT_$?
    await expect
      .poll(() => ptyWrites.join("\n"), { timeout: 15_000 })
      .toContain("[PLAYBOOK PIPELINE] Étape 1/3: Informations Système & Uptime");
    await expect
      .poll(() => ptyWrites.join("\n"), { timeout: 15_000 })
      .toContain("uname -a && uptime; echo __PB_EXIT_$?");
  });
});
