// scripts/desktop-e2e-smoke.mjs
// Desktop smoke test using tauri-driver (WebDriver) on Windows/Linux.
// Prereqs:
// 1) Install tauri-driver (https://github.com/tauri-apps/tauri-driver) and ensure it's on PATH or run it separately.
// 2) On Windows, install msedgedriver matching Edge version and add to PATH.
// 3) Build the Tauri app or run `tauri dev` in another process. This script assumes a built app path.

import { Builder, By, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';

async function run() {
  const serverUrl = process.env.TAURI_DRIVER_URL || 'http://localhost:4444/wd/hub';

  // Configure Edge (Chromium) capabilities
  const options = new edge.Options();
  // Hints for tauri-driver to attach to the app – adjust if needed for your CI
  const caps = options.toCapabilities();
  caps.set('tauri:options', {
    // If your app requires explicit bundle path or arguments, set here
    // 'args': ['--some-flag']
  });

  const driver = await new Builder()
    .usingServer(serverUrl)
    .forBrowser('MicrosoftEdge')
    .withCapabilities(caps)
    .build();

  try {
    // Wait for the main window's webview to be ready; use a known data-testid on the app root
    await driver.wait(until.elementLocated(By.css('[data-testid="app-root"]')), 15000);

    // Select rectangle tool and draw a rectangle on canvas
    const rectTool = await driver.findElement(By.css('[data-testid="tool-rectangle"]'));
    await rectTool.click();

    const stage = await driver.findElement(By.css('[data-testid="konva-stage-container"]'));
    const stageRect = await stage.getRect();

    const centerX = Math.round(stageRect.x + stageRect.width / 3);
    const centerY = Math.round(stageRect.y + stageRect.height / 3);

    // Click-drag to create rectangle
    await driver.actions().move({ x: centerX, y: centerY }).press().move({ x: centerX + 100, y: centerY + 60 }).release().perform();

    // Type text in the auto-open overlay and press Enter to commit
    // The overlay is a contentEditable div with role=textbox
    const overlay = await driver.findElement(By.css('[role="textbox"][aria-label="Shape text editor"]'));
    await overlay.sendKeys('Hello');
    await overlay.sendKeys('\uE007'); // Enter key

    // Select tool
    const selectTool = await driver.findElement(By.css('[data-testid="tool-select"]'));
    await selectTool.click();

    // Click near the rectangle to attach transformer
    await driver.actions().move({ x: centerX + 50, y: centerY + 30 }).click().perform();

    // Undo then redo via menu or keyboard shortcuts (Ctrl+Z / Ctrl+Y)
    await driver.actions().keyDown('\uE009').sendKeys('z').keyUp('\uE009').perform(); // Ctrl+Z
    await driver.actions().keyDown('\uE009').sendKeys('y').keyUp('\uE009').perform(); // Ctrl+Y

    // Basic assertion: the canvas container is still present (smoke)
    await driver.findElement(By.css('[data-testid="konva-stage-container"]'));

    console.log('[desktop-e2e-smoke] PASS');
  } catch (err) {
    console.error('[desktop-e2e-smoke] FAIL', err);
    process.exitCode = 1;
  } finally {
    try { await driver.quit(); } catch {}
  }
}

run();
