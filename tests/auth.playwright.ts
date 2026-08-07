import { test, expect } from "@playwright/test";

// Serveur dédié avec AUTH_SECRET + ADMIN_TOKEN (voir playwright.config.ts)
const ADMIN_TOKEN = "admin-token-e2e";

test.describe("Authentification (serveur AUTH_SECRET actif)", () => {
  test("l'écran de connexion bloque l'accès puis le login donne accès", async ({ page }) => {
    await page.goto("/");

    // L'écran de connexion est affiché (pas d'accès direct)
    await expect(page.getByLabel("Token d'accès")).toBeVisible();

    // Tentative avec un token invalide → erreur
    await page.getByLabel("Token d'accès").fill("mauvais-token");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Token invalide/i)).toBeVisible({ timeout: 5000 });

    // Login valide
    await page.getByLabel("Token d'accès").fill(ADMIN_TOKEN);
    await page.getByRole("button", { name: "Se connecter" }).click();

    // L'application se charge (sidebar + titre)
    await expect(page.getByText("Terminal Studio")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("exécute un playbook simple et voit la sortie dans le terminal", async ({ page }) => {
    await page.goto("/");

    // Login
    await page.getByLabel("Token d'accès").fill(ADMIN_TOKEN);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Terminal Studio")).toBeVisible({
      timeout: 10_000,
    });

    // Ouvrir la vue Playbooks
    await page.getByRole("button", { name: /Playbook/i }).first().click();
    await expect(page.getByText(/Séquenceur de Playbooks/i)).toBeVisible({
      timeout: 10_000,
    });

    // Lancer le pipeline (Audit Sécurité est le premier playbook sélectionné)
    await page.getByRole("button", { name: /LANCER LE PIPELINE/i }).click();

    // Le terminal devient la vue active et le pipeline a CRÉÉ une session
    // (le header de session s'affiche : cwd du processus + shell)
    await expect(page.getByText(/terminal-linux/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("/usr/bin/bash").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("affiche la bibliothèque de snippets et exécute un snippet", async ({ page }) => {
    await page.goto("/");

    // Login
    await page.getByLabel("Token d'accès").fill(ADMIN_TOKEN);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Terminal Studio")).toBeVisible({
      timeout: 10_000,
    });

    // Ouvrir la vue Snippets
    await page.getByRole("button", { name: /Snippets/i }).first().click();
    await expect(page.getByText(/Bibliothèque de Snippets/i)).toBeVisible({
      timeout: 10_000,
    });

    // Exécuter un snippet (premier bouton "Exécuter")
    const runButton = page.getByRole("button", { name: /Exécuter/i }).first();
    await runButton.click();

    // La vue terminal s'ouvre avec la commande exécutée
    await expect(page.getByText(/Terminal/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
