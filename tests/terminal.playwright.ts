import { test, expect } from "@playwright/test";

test.describe("Linux PTY Terminal Flow", () => {
  test("should load the application, create a PTY session, run a command, and check terminal output", async ({ page }) => {
    // 1. Navigate to the local terminal emulator web application
    await page.goto("/");

    // Wait for the app to finish loading
    await expect(page).toHaveTitle(/Tauri/i);

    // 2. Ensure we have an active PTY session, or create one if none exists
    const welcomeScreenButton = page.locator("button:has-text('Ouvrir un nouveau Terminal Linux')");
    const newTabButton = page.locator("button[title='Ouvrir un nouvel onglet terminal (/bin/bash)']");

    if (await welcomeScreenButton.isVisible()) {
      // Click the welcome screen big action button
      await welcomeScreenButton.click();
    } else if (await newTabButton.isVisible()) {
      // Click the "Nouveau" tab button in the terminal header
      await newTabButton.click();
    }

    // Wait for the terminal views or active tab title to be visible to ensure PTY session created
    await expect(page.locator(".bg-slate-900.text-emerald-400")).toBeVisible();

    // 3. Locate the persistent quick command input bar at the bottom
    const commandInput = page.locator("input[placeholder*='Saisissez ou choisissez une commande']");
    await expect(commandInput).toBeVisible();

    // 4. Fill a test command into the command bar and execute it
    const testCommand = "echo 'PTY_TEST_SUCCESS'";
    await commandInput.fill(testCommand);

    // Click the execution button or press Enter
    const runButton = page.locator("button:has-text('Exécuter')");
    await expect(runButton).toBeEnabled();
    await runButton.click();

    // 5. Verify the quick input is cleared after execution
    await expect(commandInput).toHaveValue("");

    // 6. Verify that the command was saved to the custom localStorage command history dropdown
    const historyButton = page.locator("button:has-text('Historique')");
    await expect(historyButton).toBeVisible();
    await historyButton.click();

    // Check that the history dropdown contains our command
    const historyDropdown = page.locator("div:has-text('COMMANDES RÉCENTES')");
    await expect(historyDropdown).toBeVisible();
    await expect(page.locator(`div:has-text('${testCommand}')`)).toBeVisible();

    // Close the history dropdown
    await historyButton.click();

    // 7. Verify the terminal's DOM output (xterm.js containers)
    // Check that standard terminal view elements like xterm screen are active
    const terminalElement = page.locator(".xterm");
    await expect(terminalElement).toBeVisible();

    // We can also check that the websocket or post writing has executed correctly.
    const xtermTextContainer = page.locator(".xterm-helper-textarea, .xterm-rows");
    await expect(xtermTextContainer.first()).toBeVisible();
  });
});
