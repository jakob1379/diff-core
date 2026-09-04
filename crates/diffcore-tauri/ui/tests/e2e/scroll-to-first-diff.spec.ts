/**
 * Bugfix — Playwright E2E test.
 *
 * Covers fix for:
 * - Diff viewer scrolls to the first change when a file is selected
 */
import { test, expect, type Page } from "@playwright/test";

// ── Helpers ──

/** Wait for the demo data to load and the first group to be auto-selected. */
async function waitForAnalysis(page: Page) {
  await expect(page.locator(".summary")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".group-item.selected .file-list")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("code").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2000);
}

/** Read the modified editor's visible range and first line change from the active diff editor. */
async function getVisibleRangeAndFirstChange(page: Page) {
  return page.evaluate(() => {
    const diffEditor = (window as any).monaco.editor.getDiffEditors()[0];
    const modifiedEditor = diffEditor.getModifiedEditor();
    const visibleRanges = modifiedEditor.getVisibleRanges();
    const lineChanges = diffEditor.getLineChanges() ?? [];
    const first = lineChanges[0];
    const firstChangeLine = first
      ? (first.modifiedStartLineNumber || first.modifiedEndLineNumber)
      : null;
    return {
      startLineNumber: visibleRanges[0].startLineNumber,
      endLineNumber: visibleRanges[0].endLineNumber,
      firstChangeLine,
    };
  });
}

// ── Tests ──

test.describe("Bugfix — Diff viewer scrolls to first change", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 320 });
    await page.goto("/");
    await waitForAnalysis(page);
  });

  test("01 — selecting a file reveals its first change even if the previous file was scrolled down", async ({ page }) => {
    await page.locator(".file-item").filter({ hasText: "services/auth-service.ts" }).click();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const diffEditor = (window as any).monaco.editor.getDiffEditors()[0];
      diffEditor.getModifiedEditor().setScrollTop(1e6);
    });
    await page.waitForTimeout(300);

    const scrolledDown = await getVisibleRangeAndFirstChange(page);
    expect(scrolledDown.startLineNumber).toBeGreaterThan(1);

    await page.locator(".file-item").filter({ hasText: "routes/users.ts" }).click();

    await expect.poll(async () => {
      const { startLineNumber, endLineNumber, firstChangeLine } = await getVisibleRangeAndFirstChange(page);
      if (firstChangeLine == null) return false;
      return firstChangeLine >= startLineNumber && firstChangeLine <= endLineNumber;
    }, { timeout: 10_000 }).toBe(true);
  });
});
