import { test, expect } from "@playwright/test";

// Vérifie des fonctionnalités clés : division d'écran du terminal et
// export du journal (download réel).
test.describe("Fonctionnalités", () => {
  test("divise l'écran du terminal et ouvre une session secondaire", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Terminal Principal - Bash").first()).toBeVisible({
      timeout: 10_000,
    });

    // Division horizontale (Haut / Bas)
    await page.getByTitle("Division Horizontale (Haut / Bas)").click();

    // Le panneau secondaire apparaît (placeholder honnête sans 2e session)
    await expect(page.getByText("Session secondaire non sélectionnée")).toBeVisible({
      timeout: 10_000,
    });

    // Ouvrir une 2e session → les 2 panneaux sont des terminaux réels
    await page.getByText("Ouvrir un 2ème Terminal").click();
    await expect(page.getByText("Session secondaire non sélectionnée")).not.toBeVisible({
      timeout: 10_000,
    });
    // La 2e session (nommée Terminal #…) s'affiche dans un panneau
    await expect(page.getByText(/Terminal #/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("exporte le journal affiché (download réel)", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Visualiseur de Logs").first().click();
    await expect(page.getByText("Visualiseur de Flux de Logs").first()).toBeVisible({
      timeout: 10_000,
    });

    // Le téléchargement est déclenché (fichier journal-*.log)
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByLabel("Télécharger le journal").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/journal-.*\.log/);
  });
});
