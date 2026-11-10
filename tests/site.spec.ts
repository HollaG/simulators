import { test, expect } from "@playwright/test";

test("landing connects the original desks and the published skill through the same shell", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("127.0.0.1:4173") && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Get to know your gear." }),
  ).toBeVisible();
  const header = await page.locator(".pd-header").innerText();
  const footer = await page.locator(".pd-footer").innerText();
  await expect(
    page.getByRole("link", { name: "Explore the skill" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/HollaG/simulators/tree/main/skill",
  );
  const skill = await request.get("skill/SKILL.md");
  expect(skill.ok()).toBe(true);
  expect(await skill.text()).toContain("name: hardware-simulator");
  await page
    .getByRole("link", { name: "Open MACKIE ProFX22v3 simulator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/mackie-profx22v3\/$/);
  await expect(page.locator(".pd-header")).toHaveText(
    header.replace(/\s+/g, " "),
    { useInnerText: true },
  );
  expect(await page.locator(".pd-footer").innerText()).toBe(footer);
  await expect(page.locator(".console-panel img")).toBeVisible();
  expect(
    await page
      .locator(".console-panel img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(3000);
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".panel-meter [data-lit=true]").length > 0,
  );
  await page
    .getByRole("textbox", { name: "Channel name", exact: true })
    .fill("Monorepo kick");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("profx22v3-session-v1")),
    )
    .toContain("Monorepo kick");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Channel name", exact: true }),
  ).toHaveValue("Monorepo kick");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "CineTreak", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/cinetreak-mixer-plus\/$/);
  expect(await page.locator(".pd-header").innerText()).toBe(header);
  expect(await page.locator(".pd-footer").innerText()).toBe(footer);
  await expect(page.getByTestId("program-source")).toHaveText("IN1");
  await page.getByRole("button", { name: "PVW 3", exact: true }).click();
  await page.getByRole("button", { name: "CUT", exact: true }).click();
  await expect(page.getByTestId("program-source")).toHaveText("IN3");
  await expect
    .poll(() =>
      page.getByTestId("lcd").evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        return data.filter((v, i) => i % 4 !== 3 && v > 60).length;
      }),
    )
    .toBeGreaterThan(1000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "CUT", exact: true }),
  ).toBeVisible();
  // Video desk shortcuts must leave header links' keyboard behaviour intact.
  const homeLink = page.getByRole("link", {
    name: "Practice desk home",
    exact: true,
  });
  await homeLink.focus();
  await homeLink.press("Enter");
  await expect(page).toHaveURL(/\/simulators\/$/);
  expect(errors).toEqual([]);
});

test("STAGEPAS opens from the library with real meters, manual and preserved controls", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("127.0.0.1:4173") && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("./");
  await page
    .getByRole("link", {
      name: "Open YAMAHA STAGEPAS 400i simulator",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/simulators\/yamaha-stagepas400i\/$/);
  await expect(
    page.getByRole("heading", { name: "STAGEPAS 400i", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".sp-panel > img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(2430);
  const manual = await request.get("yamaha-stagepas400i/manual.pdf");
  expect(manual.ok()).toBe(true);
  expect((await manual.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(() =>
      page
        .getByLabel("SPEAKERS measured level", { exact: true })
        .evaluate((meter: HTMLMeterElement) => meter.value),
    )
    .toBeGreaterThan(-50);
  const level = page.getByRole("slider", { name: "CH 1 LEVEL", exact: true });
  await expect(level).toHaveAttribute("aria-valuenow", "6");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(
    page.getByTitle("Yamaha STAGEPAS 400i PDF manual", { exact: true }),
  ).toBeVisible();
  await expect(level).toHaveAttribute("aria-valuenow", "6");
  await expect(
    page.getByRole("button", { name: "Stop audio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close manual", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Split view", exact: true }),
  ).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("stagepas400i-session-v1")),
    )
    .toContain('"level":6');
  await page.reload();
  await expect(level).toHaveAttribute("aria-valuenow", "6");
  await expect(
    page.getByRole("button", { name: "Mixer power", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => "__stagepas" in window)).toBe(false);
  await page
    .getByRole("link", { name: "Practice desk home", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulators\/$/);
  expect(errors).toEqual([]);
});

for (const path of [
  "",
  "mackie-profx22v3/",
  "cinetreak-mixer-plus/",
  "yamaha-stagepas400i/",
  "yamaha-mg10xu/",
  "zoom-h6essential/",
]) {
  test(`consistent header/footer, readable layout and working navigation on ${path || "landing"}`, async ({
    page,
  }) => {
    await page.goto(path || "./");
    await page.screenshot({
      path: `scratch/screenshots/${path.replace("/", "") || "landing"}-desktop.png`,
      fullPage: true,
    });
    for (const width of [390, 760]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(page.locator(".pd-header")).toBeVisible();
      await expect(page.locator(".pd-footer")).toBeAttached();
      await expect(
        page.getByRole("link", { name: "Practice desk home", exact: true }),
      ).toHaveAttribute("href", "/simulators/");
      await page.screenshot({
        path: `scratch/screenshots/${path.replace("/", "") || "landing"}-${width}.png`,
        fullPage: true,
      });
    }
  });
}
