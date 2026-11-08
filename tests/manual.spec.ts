import { test, expect } from "@playwright/test";

for (const [slug, title] of [
  ["mackie-profx22v3", "Mackie ProFX22v3"],
  ["cinetreak-mixer-plus", "CineTreak Mixer Plus"],
]) {
  test(`${title} manual splits beside the live desk without resetting it`, async ({
    page,
    request,
  }) => {
    await page.goto(`${slug}/`);
    const split = page.getByRole("button", { name: "Split view", exact: true });
    const manual = page.getByRole("complementary", {
      name: `${title} manual`,
      exact: true,
    });
    const link = page.getByRole("link", {
      name: "Open PDF in new tab",
      exact: true,
    });
    await expect(manual).not.toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const url = (await link.getAttribute("href"))!;
    const pdf = await request.get(url);
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    if (slug.startsWith("mackie")) {
      await page
        .getByRole("button", { name: "Load demo band", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Channel name", exact: true })
        .fill("Keep my mix");
      await page
        .getByRole("button", { name: "Start audio", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll(".panel-meter [data-lit=true]").length > 0,
      );
    } else {
      await page.getByRole("button", { name: "PVW 3", exact: true }).click();
      await page.getByRole("button", { name: "CUT", exact: true }).click();
    }
    await split.click();
    await expect(split).toHaveAttribute("aria-pressed", "true");
    await expect(manual).toBeVisible();
    await expect(
      page.getByTitle(`${title} PDF manual`, { exact: true }),
    ).toHaveAttribute("src", `${url}#view=FitH&navpanes=0`);
    const deskBox = (await page.locator(".pd-simulator-pane").boundingBox())!;
    const pdfBox = (await manual.boundingBox())!;
    expect(pdfBox.x).toBeGreaterThanOrEqual(deskBox.x + deskBox.width - 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (slug.startsWith("mackie")) {
      await expect(
        page.getByRole("textbox", { name: "Channel name", exact: true }),
      ).toHaveValue("Keep my mix");
      await expect(
        page.getByRole("button", { name: "Stop audio", exact: true }),
      ).toBeVisible();
    } else await expect(page.getByTestId("program-source")).toHaveText("IN3");
    await page.screenshot({
      path: `scratch/screenshots/${slug}-split.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Close manual", exact: true })
      .click();
    await expect(manual).not.toBeVisible();
    await expect(split).toBeFocused();
    await split.press("Enter");
    await expect(manual).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const mobileDesk = (await page
      .locator(".pd-simulator-pane")
      .boundingBox())!;
    const mobilePDF = (await manual.boundingBox())!;
    expect(mobilePDF.y + mobilePDF.height).toBeLessThanOrEqual(
      mobileDesk.y + 1,
    );
    await page.screenshot({
      path: `scratch/screenshots/${slug}-split-mobile.png`,
      fullPage: true,
    });
  });
}
