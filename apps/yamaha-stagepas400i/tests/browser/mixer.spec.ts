import { expect, test, type Page } from "@playwright/test";
import type { MixerState } from "../../src/state";
import type { Readings } from "../../src/audio";

type Bridge = { state: MixerState; read: () => Readings };
const read = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __stagepas: Bridge }).__stagepas.read(),
  );
const state = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __stagepas: Bridge }).__stagepas.state,
  );

async function knob(page: Page, name: string, value: number, step = 0.1) {
  const slider = page.getByRole("slider", { name, exact: true });
  await slider.press("Home");
  const min = Number(await slider.getAttribute("aria-valuemin"));
  const count = Math.round((value - min) / step);
  for (let i = 0; i < Math.floor(count / 10); i++)
    await slider.press("Shift+ArrowUp");
  for (let i = 0; i < count % 10; i++) await slider.press("ArrowUp");
  await expect(slider).toHaveAttribute("aria-valuenow", String(value));
}
async function simpleTone(page: Page, kind = "tone") {
  await page.getByLabel("Source", { exact: true }).selectOption(kind);
  await knob(page, "CH 1 LEVEL", 7);
  await knob(page, "MASTER LEVEL", 7);
  await knob(page, "MONITOR OUT", 7);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(-30);
}
function wav(antiphase = false) {
  const frames = 44100;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(44100, 24);
  buffer.writeUInt32LE(176400, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(frames * 4, 40);
  if (antiphase)
    for (let i = 0; i < frames; i++) {
      const sample = Math.round(
        Math.sin((2 * Math.PI * 1000 * i) / 44100) * 5000,
      );
      buffer.writeInt16LE(sample, 44 + i * 4);
      buffer.writeInt16LE(-sample, 46 + i * 4);
    }
  return buffer;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("real main audio follows master while monitor stays independent; power kills both", async ({
  page,
}) => {
  await simpleTone(page);
  const before = await read(page);
  await knob(page, "MASTER LEVEL", 0);
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-90);
  expect(Math.abs((await read(page)).monitor - before.monitor)).toBeLessThan(1);
  await knob(page, "MASTER LEVEL", 7);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(-30);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await expect.poll(async () => (await read(page)).monitor).toBe(-120);
  await expect(
    page.getByRole("img", { name: "Power off", exact: true }),
  ).toBeVisible();
});

test("EQ and subwoofer insertion change actual bass output without changing monitor", async ({
  page,
}) => {
  await simpleTone(page, "bass");
  const original = await read(page);
  await knob(page, "CH 1 LOW", -15, 0.5);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeLessThan(original.speakers - 7);
  await knob(page, "CH 1 LOW", 0, 0.5);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(original.speakers - 1);
  await page
    .getByRole("button", { name: "SUBWOOFER cable", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeLessThan(original.speakers - 6);
  expect(Math.abs((await read(page)).monitor - original.monitor)).toBeLessThan(
    1,
  );
  expect((await read(page)).sub).toBeGreaterThan(-30);
  await knob(page, "MASTER EQ", -1, 0.02);
  await expect
    .poll(async () => (await read(page)).sub)
    .toBeLessThan(original.speakers - 8);
  expect(Math.abs((await read(page)).monitor - original.monitor)).toBeLessThan(
    1,
  );
});

test("condenser phantom and MIC sensitivity change the real signal", async ({
  page,
}) => {
  await page.getByLabel("Source", { exact: true }).selectOption("condenser");
  await knob(page, "CH 1 LEVEL", 7);
  await knob(page, "MASTER LEVEL", 7);
  await page.getByRole("button", { name: "CH 1 MIC", exact: true }).click();
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-90);
  await page
    .getByRole("button", { name: "PHANTOM CH 1/2", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(-30);
  await page.getByRole("button", { name: "CH 1 MIC", exact: true }).click();
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-36);
  await page
    .getByRole("button", { name: "PHANTOM CH 1/2", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-90);
});

test("virtual output cables and listening volume affect the actual listening signal", async ({
  page,
}) => {
  await simpleTone(page, "bass");
  await expect
    .poll(async () => (await read(page)).listening)
    .toBeGreaterThan(-70);
  await page
    .getByRole("button", { name: "SPEAKER L cable", exact: true })
    .click();
  await page
    .getByRole("button", { name: "SPEAKER R cable", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).listening).toBeLessThan(-90);
  expect((await read(page)).speakers).toBeGreaterThan(-30);
  await page
    .getByLabel("Listening output", { exact: true })
    .selectOption("monitor");
  await expect.poll(async () => (await read(page)).listening).toBeLessThan(-90);
  await page
    .getByRole("button", { name: "MONITOR L cable", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).listening)
    .toBeGreaterThan(-70);
  await knob(page, "MASTER LEVEL", 0);
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-90);
  await expect
    .poll(async () => (await read(page)).listening)
    .toBeGreaterThan(-70);
  const before = await read(page);
  await page
    .getByRole("slider", { name: "Listening volume", exact: true })
    .press("Home");
  await expect
    .poll(async () => (await read(page)).listening)
    .toBeLessThan(before.listening - 20);
  expect(Math.abs((await read(page)).monitor - before.monitor)).toBeLessThan(1);
  await page
    .getByLabel("Listening output", { exact: true })
    .selectOption("sub");
  await expect.poll(async () => (await read(page)).listening).toBeLessThan(-90);
  await page
    .getByRole("button", { name: "SUBWOOFER cable", exact: true })
    .click();
  await knob(page, "MASTER LEVEL", 7);
  await expect
    .poll(async () => (await read(page)).listening)
    .toBeGreaterThan(-85);
});

test("limiter acts on overloaded audio while its indicator reflects the input peak", async ({
  page,
}) => {
  await simpleTone(page);
  await page.getByRole("button", { name: "CH 1 MIC", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).preLimiter)
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("img", { name: "Limiter on", exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-3);
});

test("reverb and footswitch affect measured wet audio and power-up resets the effect", async ({
  page,
}) => {
  await simpleTone(page);
  await knob(page, "CH 1 REVERB", 7);
  await expect.poll(async () => (await read(page)).reverb).toBeLessThan(-90);
  await page.getByRole("button", { name: "REVERB ON", exact: true }).click();
  await expect.poll(async () => (await read(page)).reverb).toBeGreaterThan(-70);
  await page
    .getByRole("button", { name: "REVERB FOOT SW cable", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tap footswitch", exact: false })
    .click();
  await expect.poll(async () => (await read(page)).reverb).toBeLessThan(-90);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  expect((await state(page)).reverbOn).toBe(false);
});

test("adaptive feedback filters measurably attenuate a sustained test peak and reset", async ({
  page,
}) => {
  await simpleTone(page, "feedback");
  const original = (await read(page)).speakers;
  await page
    .getByRole("button", { name: "FEEDBACK SUPPRESSOR", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).notches.length)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeLessThan(original - 12);
  await page
    .getByRole("button", { name: "FEEDBACK SUPPRESSOR", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).notches.length).toBe(0);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(original - 1);
});

test("silent priority jack mutes RCA; USB still adds to a missing 7/8 analog file", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Select channel 5/6", exact: true })
    .click();
  await page
    .getByLabel("Input connection", { exact: true })
    .selectOption("rca56");
  await page.getByLabel("Source", { exact: true }).selectOption("tone");
  await knob(page, "CH 5/6 LEVEL", 7);
  await knob(page, "MASTER LEVEL", 7);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(-30);
  await page
    .getByLabel("Input connection", { exact: true })
    .selectOption("phone56");
  await page.getByLabel("Source", { exact: true }).selectOption("file");
  await expect.poll(async () => (await read(page)).speakers).toBeLessThan(-90);
  await page
    .getByRole("button", { name: "Select channel 7/8", exact: true })
    .click();
  await page
    .getByLabel("Input connection", { exact: true })
    .selectOption("mini78");
  await page.getByLabel("Source", { exact: true }).selectOption("file");
  await page
    .getByLabel("Input connection", { exact: true })
    .selectOption("usb78");
  await page.getByLabel("Source", { exact: true }).selectOption("tone");
  await knob(page, "CH 7/8 LEVEL", 7);
  await expect
    .poll(async () => (await read(page)).speakers)
    .toBeGreaterThan(-30);
});

test("file playback, stereo-to-mono cancellation, silent files and reload relinking", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Select channel 5/6", exact: true })
    .click();
  await page.getByLabel("Source", { exact: true }).selectOption("file");
  await page.getByLabel("Local audio file", { exact: true }).setInputFiles({
    name: "stereo.wav",
    mimeType: "audio/wav",
    buffer: wav(true),
  });
  await expect(page.getByText("stereo.wav", { exact: true })).toBeVisible();
  await knob(page, "CH 5/6 LEVEL", 7);
  await knob(page, "MASTER LEVEL", 7);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect.poll(async () => (await read(page)).left).toBeGreaterThan(-30);
  await page.getByRole("button", { name: "CH 5/6 MONO", exact: true }).click();
  await expect.poll(async () => (await read(page)).left).toBeLessThan(-90);
  await page.getByRole("button", { name: "CH 5/6 MONO", exact: true }).click();
  await expect.poll(async () => (await read(page)).left).toBeGreaterThan(-30);
  await page.getByLabel("Local audio file", { exact: true }).setInputFiles({
    name: "silent.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect.poll(async () => (await read(page)).left).toBeLessThan(-90);
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("stagepas400i-session-v1")),
    )
    .toContain("silent.wav");
  await page.reload();
  await page
    .getByRole("button", { name: "Select channel 5/6", exact: true })
    .click();
  await expect(page.getByText("Relink file", { exact: true })).toBeVisible();
  await expect(page.getByText("silent.wav", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mixer power", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("slider", { name: "CH 5/6 LEVEL", exact: true }),
  ).toHaveAttribute("aria-valuenow", "7");
});

test("drag cancellation, wheel, manual split, unknown storage and responsive surface", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  const slider = page.getByRole("slider", { name: "CH 1 HIGH", exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 20);
  const value = await slider.getAttribute("aria-valuenow");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  await expect(slider).toHaveAttribute("aria-valuenow", value!);
  await page.mouse.up();
  await slider.dblclick();
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  await slider.hover();
  await page.mouse.wheel(0, -100);
  await expect(slider).toHaveAttribute("aria-valuenow", "0.5");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(
    page.getByTitle("Yamaha STAGEPAS 400i PDF manual", { exact: true }),
  ).toBeVisible();
  await expect(slider).toHaveAttribute("aria-valuenow", "0.5");
  await page.screenshot({
    path: "../../scratch/screenshots/stagepas-split.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close manual", exact: true }).click();
  await page.screenshot({
    path: "../../scratch/screenshots/stagepas-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const panelWidth = (await page.locator(".sp-panel").boundingBox())!.width;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect(
    (await page.locator(".sp-panel").boundingBox())!.width,
  ).toBeGreaterThan(panelWidth + 50);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../scratch/screenshots/stagepas-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() =>
    localStorage.setItem(
      "stagepas400i-session-v1",
      JSON.stringify({ version: 99, state: { keep: "me" } }),
    ),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "unsupported saved session was preserved",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("stagepas400i-session-v1")!).version,
    ),
  ).toBe(99);
  expect(errors).toEqual([]);
});
