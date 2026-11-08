import { chromium, expect } from "@playwright/test";

const url = process.argv[2];
if (!url)
  throw new Error(
    "Pass the practicedesk root URL, including its trailing slash.",
  );
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().startsWith(url) && response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Get to know your gear." }),
  ).toBeVisible();
  const header = await page.locator(".pd-header").innerText();
  const footer = await page.locator(".pd-footer").innerText();
  await page
    .getByRole("link", { name: "Open MACKIE ProFX22v3 simulator", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".panel-meter [data-lit=true]").length > 0,
  );
  expect(await page.locator(".pd-header").innerText()).toBe(header);
  expect(await page.locator(".pd-footer").innerText()).toBe(footer);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "CineTreak", exact: true })
    .click();
  await page.getByRole("button", { name: "PVW 3", exact: true }).click();
  await page.getByRole("button", { name: "CUT", exact: true }).click();
  await expect(page.getByTestId("program-source")).toHaveText("IN3");
  await expect
    .poll(() =>
      page.getByTestId("lcd").evaluate((canvas) => {
        const data = canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height).data;
        return data.filter((v, i) => i % 4 !== 3 && v > 60).length;
      }),
    )
    .toBeGreaterThan(1000);
  expect(await page.locator(".pd-header").innerText()).toBe(header);
  expect(await page.locator(".pd-footer").innerText()).toBe(footer);
  await page
    .getByRole("link", { name: "Practice desk home", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(url);
  const results = [];
  for (const path of ["", "mackie-profx22v3/", "cinetreak-mixer-plus/"]) {
    const response = await page.goto(new URL(path, url).href);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    results.push({ path: path || "/", status: response.status() });
  }
  const skill = await page.request.get(new URL("skill/SKILL.md", url).href);
  // The development hub serves app sources; the published skill is part of dist.
  if (new URL(url).port !== "5300") {
    expect(skill.ok()).toBe(true);
    expect(await skill.text()).toContain("name: hardware-simulator");
  }
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        url,
        pages: results,
        audioMeters: true,
        videoCutAndLCD: true,
        sharedShell: true,
        mobileFits: true,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
