import { expect, test } from "@playwright/test";

test("H6essential opens from the library with prefixed assets, manual and working recording", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("127.0.0.1") && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("./");
  await page
    .getByRole("link", { name: "Open ZOOM H6essential simulator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/zoom-h6essential\/$/);
  await expect(
    page.getByRole("heading", { name: "H6essential", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".h6-panel > img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(549);
  const pdf = await request.get("zoom-h6essential/manual.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page
    .getByRole("button", { name: "Recorder power", exact: true })
    .click();
  await page.getByRole("button", { name: "REC", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "STOP", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Download TAKE_001 MicLR WAV",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => "__h6" in window)).toBe(false);
  await page
    .getByRole("link", { name: "Practice desk home", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/$/);
  expect(errors).toEqual([]);
});
