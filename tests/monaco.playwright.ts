import { test, expect } from "@playwright/test";

// Vérifie le SELF-HOST de Monaco (public/monaco/vs) : l'éditeur se charge
// depuis le serveur local et non du CDN jsdelivr (fiabilité desktop).
test.describe("Éditeur Monaco self-hosté", () => {
  test("l'éditeur se charge depuis /monaco/vs sans CDN", async ({ page }) => {
    // Intercepter les requêtes vers le CDN jsdelivr → doit être ABSENT
    const cdnRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("jsdelivr") || req.url().includes("cdn.jsdelivr")) {
        cdnRequests.push(req.url());
      }
    });

    // Écouter la 1re requête vers le monaco local (loader.js)
    const localVsRequest = page.waitForRequest(
      (req) => req.url().includes("/monaco/vs/"),
      { timeout: 20_000 }
    );

    await page.goto("/");
    await page.getByText("Éditeur Monaco").first().click();
    await expect(page.getByText("Système de fichiers local").first()).toBeVisible({
      timeout: 10_000,
    });

    // Ouvrir un fichier réel de l'explorateur → l'éditeur se monte et
    // monaco se charge depuis le serveur local
    await page.getByText("package.json").first().click();

    // La 1re requête monaco pointe vers le self-host local
    const localReq = await localVsRequest;
    expect(localReq.url()).toContain("/monaco/vs/");

    // Aucune requête CDN jsdelivr pour Monaco
    expect(cdnRequests).toHaveLength(0);
  });
});
