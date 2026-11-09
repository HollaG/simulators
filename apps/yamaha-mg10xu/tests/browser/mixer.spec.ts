import { test, expect, type Page } from "@playwright/test";

const slider = (page: Page, name: string) =>
  page.getByRole("slider", { name, exact: true });
async function endpoint(page: Page, name: string, key: "Home" | "End") {
  await slider(page, name).focus();
  await slider(page, name).press(key);
}

test("photo controls, program confirm, attenuation, footswitch, persistence and manual", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  expect(
    await page
      .locator(".mg-panel > img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1155);
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  const stereo = page.getByLabel("STEREO OUT measured level", { exact: true });
  await expect
    .poll(() => stereo.evaluate((m: HTMLMeterElement) => m.value))
    .toBeGreaterThan(-50);
  const program = slider(page, "PROGRAM");
  await program.focus();
  await program.press("ArrowUp");
  await expect(page.getByLabel("FX display", { exact: true })).toHaveText("02");
  await expect(
    page.getByRole("heading", { name: "01 · REV HALL 1", exact: true }),
  ).toBeVisible();
  await program.press("Enter");
  await expect(
    page.getByRole("heading", { name: "02 · REV HALL 2", exact: true }),
  ).toBeVisible();
  // Let the previous press group expire before the five-press gesture.
  await page.waitForTimeout(1100);
  for (let i = 0; i < 5; i++) await program.click();
  await expect(
    page.getByRole("status").filter({ hasText: "USB attenuator" }),
  ).toBeVisible();
  await program.press("End");
  await expect(page.getByLabel("FX display", { exact: true })).toHaveText(
    "24.",
  );
  await program.press("Enter");
  await page
    .getByRole("button", { name: "Footswitch disconnected", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Press footswitch", exact: true })
    .click();
  await expect(page.locator(".mg-fx-lamp")).toHaveClass(/blink/);
  const level = slider(page, "CH 1 LEVEL");
  await level.focus();
  await level.press("ArrowDown");
  await expect(level).toHaveAttribute("aria-valuenow", "7.4");
  await page.getByRole("button", { name: "Split view", exact: true }).click();
  await expect(
    page.getByTitle("Yamaha MG10XU PDF manual", { exact: true }),
  ).toBeVisible();
  await expect(level).toHaveAttribute("aria-valuenow", "7.4");
  const pdf = await request.get("/manual.pdf");
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.getByRole("button", { name: "Close manual", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("mg10xu-session-v1")))
    .toContain('"level":7.4');
  await page.screenshot({
    path: "../../scratch/screenshots/mg10xu-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(level).toHaveAttribute("aria-valuenow", "7.4");
  await expect(
    page.getByRole("button", { name: "Mixer power", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("real signal paths isolate USB return, keep recording pre-master, and mute monitors only", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const audioPath = "/src/audio.ts",
      statePath = "/src/state.ts";
    const { MixerAudio } = await import(audioPath),
      { createDefault } = await import(statePath);
    const engine = new MixerAudio();
    await engine.start();
    const s = createDefault();
    s.power = true;
    s.master = 7.5;
    s.monitor = 7.5;
    s.usb = true;
    s.inputs.usb910.kind = "tone";
    s.channels[6].level = 7.5;
    const read = async () => {
      engine.update(s, "phones", -40);
      await new Promise((r) => setTimeout(r, 350));
      return engine.readings();
    };
    try {
      const normal = await read();
      s.master = 0;
      const masterDown = await read();
      s.master = 7.5;
      s.toStereo = false;
      const direct = await read();
      s.stereoMute = true;
      const mutedDirect = await read();
      s.inputs.ch1.kind = "tone";
      s.inputs.ch1.plug = "phone";
      s.channels[0].gain = 32;
      s.channels[0].level = 7.5;
      const mixMuted = await read();
      s.stereoMute = false;
      const mixOpen = await read();
      s.attenuator = -24;
      const attenuated = await read();
      s.attenuator = 0;
      s.inputs.ch1.kind = "none";
      s.fxOn = true;
      s.fxReturn = 7.5;
      s.fxConnected = true;
      s.channels[6].fx = 7.5;
      s.program = 22;
      const monitorFx = await read();
      return {
        normal,
        masterDown,
        direct,
        mutedDirect,
        mixMuted,
        mixOpen,
        attenuated,
        monitorFx,
      };
    } finally {
      await engine.dispose();
    }
  });
  expect(result.normal.stereo).toBeGreaterThan(-20);
  expect(result.masterDown.stereo).toBeLessThan(-90);
  expect(result.masterDown.usb).toBeCloseTo(result.normal.usb, 0);
  expect(result.direct.stereo).toBeLessThan(-90);
  expect(result.direct.usb).toBeLessThan(-90);
  expect(result.direct.phones).toBeGreaterThan(-20);
  expect(result.mutedDirect.phones).toBeCloseTo(result.direct.phones, 0);
  expect(result.mixMuted.stereo).toBeGreaterThan(-20);
  expect(result.mixMuted.phones).toBeCloseTo(result.mutedDirect.phones, 0);
  expect(result.mixOpen.phones).toBeGreaterThan(result.mixMuted.phones + 3);
  expect(result.attenuated.usb).toBeCloseTo(result.mixOpen.usb, 0);
  // TO MON diverts dry 9/10, but the block diagram keeps its FX send live.
  expect(result.monitorFx.fx).toBeGreaterThan(-20);
  expect(result.monitorFx.usb).toBeGreaterThan(-40);
});

test("measured HPF, EQ, PAD, phantom and pan change the actual audio", async ({
  page,
}) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const audioPath = "/src/audio.ts",
      statePath = "/src/state.ts";
    const { MixerAudio } = await import(audioPath),
      { createDefault } = await import(statePath);
    const engine = new MixerAudio();
    await engine.start();
    const s = createDefault();
    s.power = true;
    s.master = 7.5;
    s.channels[0].level = 7.5;
    s.channels[0].gain = 32;
    s.inputs.ch1.kind = "bass";
    s.inputs.ch1.plug = "phone";
    const read = async () => {
      engine.update(s, "stereo", -40);
      await new Promise((r) => setTimeout(r, 400));
      return engine.readings();
    };
    try {
      const base = await read();
      s.channels[0].hpf = true;
      const hpf = await read();
      s.channels[0].hpf = false;
      s.channels[0].low = 15;
      const eq = await read();
      s.channels[0].low = 0;
      s.channels[0].pad = true;
      const pad = await read();
      s.channels[0].pad = false;
      s.inputs.ch1.plug = "xlr";
      const sameGainXlr = await read();
      s.inputs.ch1.kind = "condenser";
      s.inputs.ch1.plug = "xlr";
      s.channels[0].gain = 42;
      const phantomOff = await read();
      s.phantom = true;
      const phantomOn = await read();
      s.channels[0].pan = -1;
      const left = await read();
      return { base, hpf, eq, pad, sameGainXlr, phantomOff, phantomOn, left };
    } finally {
      await engine.dispose();
    }
  });
  expect(r.hpf.stereo).toBeLessThan(r.base.stereo - 10);
  expect(r.eq.stereo).toBeGreaterThan(r.base.stereo + 10);
  expect(r.pad.stereo).toBeCloseTo(r.base.stereo - 26, 0);
  expect(r.sameGainXlr.stereo).toBeCloseTo(r.base.stereo, 0);
  expect(r.phantomOff.stereo).toBeLessThan(-90);
  expect(r.phantomOn.stereo).toBeGreaterThan(-40);
  expect(r.left.left).toBeGreaterThan(-40);
  expect(r.left.right).toBeLessThan(-90);
});

test("all 24 FX programs produce wet audio and external send survives FX OFF", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const audioPath = "/src/audio.ts",
      statePath = "/src/state.ts";
    const { MixerAudio } = await import(audioPath),
      { createDefault } = await import(statePath);
    const engine = new MixerAudio();
    await engine.start();
    const s = createDefault();
    s.power = true;
    s.master = 7.5;
    s.fxReturn = 7.5;
    s.fxOn = true;
    s.fxConnected = true;
    s.channels[0].level = 7.5;
    s.channels[0].fx = 7.5;
    s.channels[0].gain = 32;
    s.inputs.ch1.kind = "tone";
    s.inputs.ch1.plug = "phone";
    const levels = [];
    try {
      for (let program = 1; program <= 24; program++) {
        s.program = program;
        engine.update(s, "stereo", -40);
        await new Promise((r) => setTimeout(r, 700));
        // Wet tap is measured independently from dry mix; no fake LEDs can satisfy this.
        const analyser = engine.context.createAnalyser();
        engine.effects.output.connect(analyser);
        await new Promise((r) => setTimeout(r, 80));
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        levels.push(Math.max(...samples.map(Math.abs)));
        engine.effects.output.disconnect(analyser);
      }
      s.fxOn = false;
      engine.update(s, "fx", -40);
      await new Promise((r) => setTimeout(r, 400));
      return { levels, fx: engine.readings().fx };
    } finally {
      await engine.dispose();
    }
  });
  expect(r.levels).toHaveLength(24);
  r.levels.forEach((v: number) => expect(v).toBeGreaterThan(0.00001));
  expect(r.fx).toBeGreaterThan(-20);
});

test("pointer cancellation, wheel, mobile layout and missing local file relink", async ({
  page,
}) => {
  await page.goto("/");
  const gain = slider(page, "CH 1 GAIN");
  const box = (await gain.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 45);
  await page.mouse.up();
  const value = await gain.getAttribute("aria-valuenow");
  expect(Number(value)).toBeGreaterThan(20);
  await page.mouse.move(50, 50);
  await expect(gain).toHaveAttribute("aria-valuenow", value!);
  await gain.hover();
  await page.mouse.down();
  await gain.dispatchEvent("pointercancel");
  await page.mouse.move(box.x + box.width / 2, box.y - 80);
  await page.mouse.up();
  await expect(gain).toHaveAttribute("aria-valuenow", value!);
  await gain.focus();
  await gain.press("Home");
  await gain.hover();
  await page.mouse.wheel(0, -100);
  await expect(gain).toHaveAttribute("aria-valuenow", "21");
  const wav = Buffer.alloc(44 + 8000 * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await page
    .getByLabel("Load local audio", { exact: true })
    .setInputFiles({ name: "silent.wav", mimeType: "audio/wav", buffer: wav });
  await expect(page.getByText("silent.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await endpoint(page, "CH 1 LEVEL", "End");
  await endpoint(page, "STEREO LEVEL", "End");
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop audio", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  expect(
    await page
      .getByLabel("STEREO OUT measured level", { exact: true })
      .evaluate((m: HTMLMeterElement) => m.value),
  ).toBe(-60);
  await page.reload();
  await expect(
    page.getByText("File missing after reload.", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Load local audio", { exact: true })
    .setInputFiles({ name: "silent.wav", mimeType: "audio/wav", buffer: wav });
  await expect(
    page.getByText("File missing after reload.", { exact: false }),
  ).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../scratch/screenshots/mg10xu-mobile.png",
    fullPage: true,
  });
});

test("preserves an unknown saved version until the owner resets the desk", async ({
  page,
}) => {
  await page.goto("/");
  const saved = JSON.stringify({
    version: 99,
    settings: { keep: "future desk" },
  });
  await page.evaluate(
    (value) => localStorage.setItem("mg10xu-session-v1", value),
    saved,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("unsupported version");
  await endpoint(page, "CH 1 LEVEL", "End");
  expect(
    await page.evaluate(() => localStorage.getItem("mg10xu-session-v1")),
  ).toBe(saved);
  await page.getByRole("button", { name: "Reset desk", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("mg10xu-session-v1")!).version,
      ),
    )
    .toBe(1);
});
