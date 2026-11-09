import { test, expect } from "@playwright/test";

test("MG10XU production route, audio, manual and home links work under the repository prefix", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().includes("127.0.0.1:4173") && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("./");
  await page
    .getByRole("link", { name: "Open YAMAHA MG10XU simulator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/yamaha-mg10xu\/$/);
  await expect(
    page.getByRole("heading", { name: "Yamaha MG10XU", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByLabel("STEREO OUT measured level", { exact: true })
        .evaluate((m: HTMLMeterElement) => m.value),
    )
    .toBeGreaterThan(-50);
  const pdf = await request.get("yamaha-mg10xu/manual.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(
    page.getByTitle("Yamaha MG10XU PDF manual", { exact: true }),
  ).toHaveAttribute(
    "src",
    "/simulators/yamaha-mg10xu/manual.pdf#view=FitH&navpanes=0",
  );
  await expect(
    page.getByRole("slider", { name: "CH 1 GAIN", exact: true }),
  ).toHaveAttribute("aria-valuenow", "42");
  await page.getByRole("button", { name: "Close manual", exact: true }).click();
  await page.getByRole("slider", { name: "PROGRAM", exact: true }).focus();
  await page.getByRole("slider", { name: "PROGRAM", exact: true }).press("End");
  await page
    .getByRole("slider", { name: "PROGRAM", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "24 · PITCH CHANGE", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "scratch/screenshots/mg10xu-split-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Practice desk home", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/$/);
  expect(errors).toEqual([]);
});
