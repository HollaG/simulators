import { expect, test, type Page } from "@playwright/test";

const screen = (page: Page) => page.getByRole("img", { name: "Enlarged device display", exact: true });
const knob = (page: Page, side: "Left" | "Right") => page.getByRole("button", { name: `${side} knob`, exact: true });
const power = (page: Page) => page.getByRole("button", { name: "Fixture power", exact: true }).click();
const menu = (page: Page) => page.getByRole("button", { name: "MENU", exact: true }).click();
const errors = new Map<Page, string[]>();
test.beforeEach(({ page }) => {
  errors.set(page, []);
  page.on("pageerror", error => errors.get(page)!.push(error.message));
});
test.afterEach(({ page }) => { expect(errors.get(page)).toEqual([]); errors.delete(page); });

test("physical wheel, presets, blackout and drag affect the actual output without accidental presses", async ({ page }) => {
  await page.goto("/"); await power(page);
  await expect(screen(page)).toContainText("20%");
  const left = knob(page, "Left"), right = knob(page, "Right");
  await left.hover(); await page.mouse.wheel(0, -100);
  await expect(screen(page)).toContainText("21%");
  await right.click(); await expect(screen(page)).toContainText("6500K");
  // Read the real signal and pixel intensity, not just the displayed DIM value.
  const output = page.locator("canvas");
  const litPixel = () => output.evaluate((c: HTMLCanvasElement) => Array.from(c.getContext("2d")!.getImageData(260, 230, 1, 1).data).slice(0, 3).reduce((a, b) => a + b));
  await expect.poll(async () => Number(await output.getAttribute("data-level"))).toBeGreaterThan(0);
  const lit = await litPixel();
  await left.click(); await expect(screen(page)).toContainText("0%");
  await expect(output).toHaveAttribute("data-level", "0.00");
  expect(await litPixel()).toBeLessThan(lit);
  await left.click(); await expect(screen(page)).toContainText("21%");
  const box = (await left.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30, { steps: 5 }); await page.mouse.up();
  await expect(screen(page)).toContainText("26%");
  await left.press("ArrowDown"); await expect(screen(page)).toContainText("25%");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await left.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30);
  await page.mouse.up();
  await expect(screen(page)).toContainText("25%");
  await page.reload(); await expect(page.getByRole("button", { name: "Fixture power" })).toHaveAttribute("aria-pressed", "false");
  await power(page); await expect(screen(page)).toContainText("25%");
});

test("menu drafts, fan limits, screen rotation and manual viewer retain the operating state", async ({ page }) => {
  await page.goto("/"); await power(page);
  await knob(page, "Left").press("PageUp"); await knob(page, "Left").press("PageUp");
  await menu(page); const right = knob(page, "Right");
  for (let i = 0; i < 3; i++) await right.press("ArrowUp");
  await right.click(); for (let i = 0; i < 3; i++) await right.press("ArrowUp");
  await expect(screen(page)).toContainText("OFF");
  await right.click(); await expect(screen(page)).toContainText("MAX POWER: 15%");
  await expect.poll(async () => Number(await page.locator("canvas").getAttribute("data-level"))).toBeLessThanOrEqual(15);
  await menu(page); await right.press("ArrowUp"); await right.click(); await right.press("ArrowUp"); await right.click();
  await expect(screen(page)).toHaveAttribute("data-rotated", "true");
  await menu(page); await menu(page);
  await expect(screen(page)).toContainText("40%");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(page.getByTitle("Nanlite FC-120B PDF manual", { exact: true })).toBeVisible();
  await expect(screen(page)).toContainText("40%");
  await page.getByRole("button", { name: "Close manual", exact: true }).click();
  await page.reload(); await power(page);
  await expect(screen(page)).toHaveAttribute("data-rotated", "true");
  await expect(screen(page)).toContainText("40%");
});

test("effect selection, parameter editing, manual triggering and power interruptions", async ({ page }) => {
  await page.goto("/"); await power(page);
  await page.getByRole("button", { name: "MODE", exact: true }).click();
  const left = knob(page, "Left"), right = knob(page, "Right");
  await expect(screen(page)).toContainText("CCT LOOP");
  for (let i = 0; i < 4; i++) await right.press("ArrowUp");
  await left.press("ArrowDown"); await expect(screen(page)).toContainText("7s");
  await right.press("ArrowUp"); // return to effect selection
  for (let i = 0; i < 5; i++) await left.press("ArrowUp");
  await expect(screen(page)).toContainText("STORM MANUAL");
  await expect(page.locator("canvas")).toHaveAttribute("data-level", "0.00");
  await right.click();
  await expect.poll(async () => Number(await page.locator("canvas").getAttribute("data-level"))).toBeGreaterThan(0);
  await power(page); await expect(page.locator("canvas")).toHaveAttribute("data-level", "0.00");
  await power(page); await expect(page.locator("canvas")).toHaveAttribute("data-level", "0.00");
});

test("desktop/mobile panel alignment, PDF assets, local storage failure and future schemas", async ({ page, request }) => {
  await page.goto("/");
  const pdf = await request.get("/manual.pdf"); expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await power(page);
  await page.screenshot({ path: "../../scratch/screenshots/fc120b-desktop.png", fullPage: true });
  for (const width of [390, 760]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const image = (await page.locator(".fc-panel > img").boundingBox())!;
    const display = (await page.locator(".fc-screen").boundingBox())!;
    expect((display.x - image.x) / image.width).toBeCloseTo(0.374, 2);
    await page.screenshot({ path: `../../scratch/screenshots/fc120b-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => localStorage.setItem("fc120b-session-v1", '{"version":99,"config":{"future":true}}'));
  await page.reload(); await expect(page.getByRole("alert")).toContainText("left untouched");
  await power(page); await knob(page, "Left").press("ArrowUp");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fc120b-session-v1")!).version)).toBe(99);
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await page.evaluate(() => localStorage.removeItem("fc120b-session-v1")); await page.reload();
  await expect(page.getByRole("alert")).toContainText("storage is unavailable");
  await power(page); await expect(screen(page)).toContainText("20%");
});
