import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const down = async (page: Page, count = 1) => {
  for (let i = 0; i < count; i++)
    await button(page, "Selection dial down").click();
};
const enter = (page: Page) => button(page, "ENTER").click();
async function power(page: Page) {
  await page.goto("/");
  await button(page, "Recorder power").click();
  await expect(button(page, "Recorder power")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForFunction(() => (window as any).__h6.readings.time > 0.35);
}

test("record, mark, HOLD, stop, play and download the recorded samples", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await power(page);
  await expect
    .poll(() =>
      page
        .getByLabel("MIC measured level", { exact: true })
        .evaluate((m: HTMLMeterElement) => m.value),
    )
    .toBeGreaterThan(-40);
  await button(page, "Track 1").click();
  await button(page, "REC").click();
  await page.waitForFunction(
    () => (window as any).__h6.state.mode === "recording",
  );
  await page.waitForTimeout(1100);
  await enter(page);
  await expect(page.getByRole("status")).toContainText("Mark 1 added");
  await button(page, "HOLD").click();
  await expect(button(page, "STOP")).toBeDisabled();
  await page.waitForTimeout(600);
  await button(page, "HOLD").click();
  await button(page, "STOP").click();
  await expect(
    page.getByRole("button", {
      name: "Download TAKE_001 MicLR WAV",
      exact: true,
    }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await button(page, "Download TAKE_001 MicLR WAV").click();
  const download = await downloadEvent;
  const data = await readFile((await download.path())!);
  expect(data.subarray(0, 4).toString()).toBe("RIFF");
  expect(data.readUInt16LE(20)).toBe(3);
  expect(data.readUInt16LE(22)).toBe(2);
  expect(data.readUInt32LE(24)).toBe(48000);
  expect(data.byteLength).toBeGreaterThan(48000 * 4 * 2);
  await button(page, "PLAY / PAUSE").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__h6.state.mode))
    .toBe("playing");
  await expect
    .poll(() =>
      page
        .getByLabel("MIC measured level", { exact: true })
        .evaluate((m: HTMLMeterElement) => m.value),
    )
    .toBeGreaterThan(-40);
  await button(page, "PLAY / PAUSE").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__h6.readings.waves[0].some(
          (v: number) => Math.abs(v) > 0.01,
        ),
      ),
    )
    .toBe(true);
  await button(page, "FF — next / hold to search").click();
  expect(
    await page.evaluate(() => (window as any).__h6.state.position),
  ).toBeGreaterThan(0.9);
  await button(page, "Split view").click();
  await expect(
    page.getByTitle("Zoom H6essential PDF manual", { exact: true }),
  ).toBeVisible();
  await expect(button(page, "Download TAKE_001 MicLR WAV")).toBeVisible();
  await button(page, "Close manual").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../scratch/screenshots/h6essential-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("dial navigation applies input filtering, phantom, linking and recording rate; settings survive reload", async ({
  page,
}) => {
  await power(page);
  await down(page);
  await enter(page); // Input tabs
  await down(page);
  await enter(page); // Input 1
  await enter(page);
  await down(page, 2);
  await enter(page); // 160 Hz
  await down(page);
  await enter(page);
  await down(page);
  await enter(page); // phantom On
  await down(page);
  await enter(page);
  await down(page);
  await enter(page); // Stereo
  await button(page, "STOP").click();
  await button(page, "Track 1").click();
  await expect(button(page, "Track 2")).toHaveAttribute("aria-pressed", "true");
  await down(page, 3);
  await enter(page);
  await enter(page);
  await down(page);
  await enter(page); // 96 kHz
  await button(page, "STOP").click();
  await page.reload();
  await button(page, "Recorder power").click();
  const config = await page.evaluate(() => (window as any).__h6.state.config);
  expect(config.inputs[1].lowCut).toBe(160);
  expect(config.inputs[1].phantom).toBe(true);
  expect(config.links[0]).toBe(true);
  expect(config.rate).toBe(96000);
  await button(page, "REC").click();
  await page.waitForTimeout(350);
  await button(page, "REC").click();
  await expect(button(page, "Download TAKE_001 Tr12 WAV")).toBeVisible();
  await expect(button(page, "Download TAKE_001 LR WAV")).toHaveCount(0);
});

test("audio samples prove pre/post mixer, phantom gating, Lo Cut and 96 kHz routing", async ({
  page,
}) => {
  await power(page);
  const results = await page.evaluate(async () => {
    const audioPath = "/src/audio.ts",
      statePath = "/src/state.ts";
    const { RecorderAudio } = await import(/* @vite-ignore */ audioPath);
    const { defaults } = await import(/* @vite-ignore */ statePath);
    const audio = new RecorderAudio();
    const config = defaults();
    config.inputs.forEach((i: any) => {
      i.armed = true;
      i.gain = -20;
    });
    const draft = {
      id: 100,
      name: "test",
      duration: 0.3,
      startedAt: 0,
      config,
      events: [{ time: 0, gains: [-20, -20, -20, -20, -20] }],
      marks: [],
      trashed: false,
    };
    const power = (b: AudioBuffer, ch: number) => {
      const data = b.getChannelData(ch).slice(480);
      return data.reduce((sum, v) => sum + v * v, 0) / data.length;
    };
    const pre = await audio.render(draft);
    config.post = true;
    const post = await audio.render({ ...draft, id: 101 });
    config.post = false;
    config.inputs[1].source = "condenser";
    const noPhantom = await audio.render({ ...draft, id: 102 });
    config.inputs[1].phantom = true;
    const phantom = await audio.render({ ...draft, id: 103 });
    config.inputs[0].lowCut = 240;
    const cut = await audio.render({ ...draft, id: 104 });
    config.rate = 96000;
    const highRate = await audio.render({ ...draft, id: 105 });
    const result = {
      ratio: power(post, 0) / power(pre, 0),
      stereoRatio: power(post, 6) / power(pre, 6),
      noPhantom: power(noPhantom, 2),
      phantom: power(phantom, 2),
      cutRatio: power(cut, 0) / power(pre, 0),
      highRate: highRate.sampleRate,
      highRateMix: power(highRate, 6),
      raw: power(highRate, 0),
    };
    audio.close();
    return result;
  });
  expect(results.ratio).toBeCloseTo(0.01, 3);
  expect(results.stereoRatio).toBeCloseTo(1, 4);
  expect(results.noPhantom).toBe(0);
  expect(results.phantom).toBeGreaterThan(0.001);
  expect(results.cutRatio).toBeLessThan(0.7);
  expect(results.highRate).toBe(96000);
  expect(results.highRateMix).toBe(0);
  expect(results.raw).toBeGreaterThan(0);
});

test("mixer and headphone volume affect real monitoring independently; disconnected source is silent", async ({
  page,
}) => {
  await power(page);
  const level = () =>
    page
      .getByLabel("MIC measured level", { exact: true })
      .evaluate((m: HTMLMeterElement) => m.value);
  const baseline = await level();
  await button(page, "MIXER").click();
  await enter(page);
  await down(page, 0);
  for (let i = 0; i < 20; i++) await button(page, "Selection dial up").click();
  await expect.poll(level).toBeLessThan(baseline - 15);
  await button(page, "Listen with headphones").click();
  await page
    .getByRole("slider", { name: "Headphone volume", exact: true })
    .fill("0");
  await expect
    .poll(() => page.evaluate(() => (window as any).__h6.readings.mix[0]))
    .toBeGreaterThan(-65);
  await button(page, "STOP").click();
  await page
    .getByLabel("MIC practice source", { exact: true })
    .selectOption("off");
  await expect
    .poll(() => page.evaluate(() => (window as any).__h6.readings.levels[0]))
    .toBeLessThan(-95);
});

test("held seek cancels on blur; keyboard dial and mobile panel remain usable", async ({
  page,
}) => {
  await power(page);
  await button(page, "REC").click();
  await page.waitForTimeout(2500);
  await button(page, "STOP").click();
  await expect(button(page, "Download TAKE_001 MicLR WAV")).toBeVisible();
  await button(page, "PLAY / PAUSE").click();
  await button(page, "PLAY / PAUSE").click();
  const ff = button(page, "FF — next / hold to search");
  const box = (await ff.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const position = await page.evaluate(
    () => (window as any).__h6.state.position,
  );
  expect(position).toBeGreaterThan(0.7);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__h6.state.position)).toBe(
    position,
  );
  await page.mouse.up();
  await button(page, "STOP").click();
  const dial = page.getByRole("slider", {
    name: "Selection dial",
    exact: true,
  });
  await dial.focus();
  await dial.press("ArrowDown");
  await dial.press("Enter");
  expect(await page.evaluate(() => (window as any).__h6.state.screen)).toBe(
    "input",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await button(page, "STOP").click();
  await button(page, "Track 3").click();
  await expect(button(page, "Track 3")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "../../scratch/screenshots/h6essential-mobile.png",
    fullPage: true,
  });
});
