import { test, expect, type Page } from "@playwright/test";
type Bridge = {
  state: import("../../src/state").MixerState;
  read: () => import("../../src/audio").Readings;
};
async function read(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __mixer: Bridge }).__mixer.read(),
  );
}
async function setChannel(page: Page, source = "tone") {
  await page.getByLabel("Source", { exact: true }).first().selectOption(source);
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
}
async function hardwareValue(page: Page, label: string, value: number) {
  const slider = page.getByRole("slider", { name: label, exact: true });
  await slider.focus();
  if (value === -90) await slider.press("Home");
  else {
    await slider.press("End");
    for (
      let i = 0;
      i < 60 && Number(await slider.getAttribute("aria-valuenow")) > value;
      i++
    )
      await slider.press("ArrowDown");
    await expect(slider).toHaveAttribute("aria-valuenow", String(value));
  }
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("power interrupts audio and cancels a drag; logarithmic keyboard steps do not get stuck", async ({
  page,
}) => {
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect.poll(async () => (await read(page)).running).toBe(true);
  const frequency = page.getByRole("slider", {
    name: "CH 1 Mid frequency",
    exact: true,
  });
  await frequency.press("Home");
  await frequency.press("ArrowUp");
  await expect(frequency).toHaveAttribute("aria-valuenow", "110");
  const gain = page.getByRole("slider", { name: "CH 1 Gain", exact: true });
  const box = (await gain.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 10);
  const dragged = await gain.getAttribute("aria-valuenow");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  await expect(gain).toHaveAttribute("aria-valuenow", dragged!);
  await page.mouse.up();
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await expect(gain).toBeDisabled();
  await expect.poll(async () => (await read(page)).running).toBe(false);
  await page.getByRole("button", { name: "Mixer power", exact: true }).click();
  await expect(gain).toBeEnabled();
  await expect.poll(async () => (await read(page)).running).toBe(true);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __mixer: Bridge }).__mixer.state.bootUntil >
        performance.now(),
    ),
  ).toBe(true);
});

test("preserves unsupported saved versions instead of overwriting them", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "profx22v3-session-v1",
      JSON.stringify({ version: 99, state: { important: "preserve me" } }),
    ),
  );
  await page.reload();
  await expect(
    page.getByText("Saved session has an unsupported version.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load demo band", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("profx22v3-session-v1")!).version,
      ),
    )
    .toBe(99);
});

test("real audio follows mute, pre-fader MON1, PFL, pan and subgroup routing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await read(page)).buses.main + 3))
    .toBeLessThan(0.1);
  const initial = (await read(page)).buses.main;
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("-12");
  await expect
    .poll(async () => Math.abs((await read(page)).buses.main - initial + 12))
    .toBeLessThan(1);
  await hardwareValue(page, "CH 1 MON 1 send", 0);
  await expect
    .poll(async () => (await read(page)).buses.mon1)
    .toBeGreaterThan(-3);
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("-90");
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeLessThan(-70);
  expect((await read(page)).buses.mon1).toBeGreaterThan(-3);
  await page.getByRole("button", { name: "CH 1 Mute", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).buses.mon1)
    .toBeLessThan(-70);
  await page
    .getByRole("button", { name: "CH 1 PFL Solo", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).left).toBeGreaterThan(-3);
  expect((await read(page)).right).toBeLessThan(-90);
  expect((await read(page)).buses.phones).toBeGreaterThan(-15);
  expect((await read(page)).buses.main).toBeLessThan(-70);
  await page
    .getByRole("button", { name: "CH 1 PFL Solo", exact: true })
    .click();
  await page.getByRole("button", { name: "CH 1 Mute", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "CH 1 Assign L–R", exact: true })
    .click();
  await page
    .getByRole("button", { name: "CH 1 Assign 1–2", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeLessThan(-70);
  expect((await read(page)).buses.sub12).toBeGreaterThan(-8);
  await page
    .getByRole("button", { name: "Sub 1–2 assign L–R", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeGreaterThan(-8);
  const pan = page.getByRole("slider", { name: "CH 1 Pan", exact: true });
  await pan.press("Home");
  await expect.poll(async () => (await read(page)).right).toBeLessThan(-70);
  expect((await read(page)).left).toBeGreaterThan(-3);
  expect(errors).toEqual([]);
});

test("MON3 pre/post, break and phantom change actual outputs", async ({
  page,
}) => {
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await hardwareValue(page, "CH 1 MON 3 send", 0);
  await expect
    .poll(async () => (await read(page)).buses.mon3)
    .toBeGreaterThan(-3);
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("-90");
  await expect
    .poll(async () => (await read(page)).buses.mon3)
    .toBeLessThan(-70);
  await page
    .getByRole("button", { name: "CH 1 MON 3 pre-fader", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.mon3)
    .toBeGreaterThan(-3);
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
  await page.getByRole("button", { name: "Break", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeLessThan(-70);
  expect((await read(page)).buses.mon3).toBeGreaterThan(-3);
  await page.getByRole("button", { name: "Break", exact: true }).click();
  await page
    .getByLabel("Input type", { exact: true })
    .selectOption("condenser");
  await expect
    .poll(async () => (await read(page)).channel[0])
    .toBeLessThan(-70);
  await page
    .getByRole("spinbutton", { name: "Inspector Mic gain", exact: true })
    .fill("40");
  await page
    .getByRole("button", { name: "48V Phantom power", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeGreaterThan(-8);
});

test("post-fader FX produces a real wet return; mute and preset confirmation work", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Clear desk", exact: true }).click();
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await hardwareValue(page, "CH 1 FX send", 0);
  await hardwareValue(page, "FX return fader", 0);
  await page
    .getByRole("button", { name: "CH 1 Assign L–R", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeGreaterThan(-40);
  await page.getByRole("button", { name: "FX Mute", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeLessThan(-70);
  const encoder = page.getByRole("button", {
    name: "FX preset encoder, arrows to browse, Enter to confirm",
    exact: true,
  });
  await encoder.press("ArrowRight");
  await expect(
    page.getByLabel("FX preset display", { exact: true }),
  ).toHaveText("02");
  expect(
    await page.evaluate(
      () => (window as unknown as { __mixer: Bridge }).__mixer.state.preset,
    ),
  ).toBe(1);
  await encoder.press("Enter");
  expect(
    await page.evaluate(
      () => (window as unknown as { __mixer: Bridge }).__mixer.state.preset,
    ),
  ).toBe(2);
});

test("EQ and compressor alter measured audio, and all 24 effect programs produce wet audio", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Clear desk", exact: true }).click();
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await read(page)).buses.main + 3))
    .toBeLessThan(0.1);
  const original = (await read(page)).buses.main;
  await page
    .getByRole("spinbutton", { name: "Inspector Mid frequency", exact: true })
    .fill("1000");
  await page
    .getByRole("spinbutton", { name: "Inspector Mid EQ", exact: true })
    .fill("12");
  await expect
    .poll(async () => Math.abs((await read(page)).buses.main - original - 12))
    .toBeLessThan(0.3);
  await page
    .getByRole("spinbutton", { name: "Inspector Mid EQ", exact: true })
    .fill("0");
  await page
    .getByRole("spinbutton", { name: "Inspector Gain", exact: true })
    .fill("20");
  await expect
    .poll(async () => (await read(page)).channel[0])
    .toBeGreaterThan(19);
  await page
    .getByRole("slider", { name: "CH 1 Compressor", exact: true })
    .press("End");
  // Browser compressors include automatic makeup gain. Verify actual reduction,
  // without treating the browser's transfer curve as the analog hardware's curve.
  await expect.poll(async () => (await read(page)).channel[0]).toBeLessThan(16);
  await page
    .getByRole("slider", { name: "CH 1 Compressor", exact: true })
    .press("Home");
  await page
    .getByRole("spinbutton", { name: "Inspector Gain", exact: true })
    .fill("0");
  await hardwareValue(page, "CH 1 FX send", 0);
  await hardwareValue(page, "FX return fader", 0);
  await page
    .getByRole("button", { name: "CH 1 Assign L–R", exact: true })
    .click();
  const encoder = page.getByRole("button", {
    name: "FX preset encoder, arrows to browse, Enter to confirm",
    exact: true,
  });
  for (let program = 1; program <= 24; program++) {
    if (program > 1) {
      await encoder.press("ArrowRight");
      await encoder.press("Enter");
    }
    await expect
      .poll(async () => (await read(page)).buses.main, {
        message: `FX ${program} must produce a wet signal`,
      })
      .toBeGreaterThan(-55);
  }
});

test("stereo line preserves L/R, bypasses hybrid mic gain, and the final strip selects USB3–4", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Inspect channel 15/16", exact: true })
    .click();
  const wav = Buffer.alloc(44 + 48000 * 4);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(192000, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 48000; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i / 48000) * Math.PI * 2 * 1000) * 4129),
      44 + i * 4,
    );
  await page.getByLabel("Import audio file", { exact: true }).setInputFiles({
    name: "left-only.wav",
    mimeType: "audio/wav",
    buffer: wav,
  });
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect.poll(async () => (await read(page)).left).toBeGreaterThan(-1);
  expect((await read(page)).right).toBeLessThan(-70);
  await page
    .getByRole("spinbutton", { name: "Inspector Gain", exact: true })
    .fill("60");
  await expect
    .poll(async () => Math.abs((await read(page)).left))
    .toBeLessThan(0.3);
  await page
    .getByRole("button", { name: "CH 15/16 Low cut", exact: true })
    .click();
  expect((await read(page)).right).toBeLessThan(-70);
  await page
    .getByRole("button", { name: "CH 15/16 Mute", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect channel 21/22", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
  await page.getByText("USB returns & practice tools", { exact: true }).click();
  await page
    .locator(".usb-source")
    .nth(1)
    .getByLabel("Source", { exact: true })
    .selectOption("tone");
  await page
    .getByRole("button", { name: "USB 3–4 to channel 21/22", exact: true })
    .click();
  await expect.poll(async () => (await read(page)).right).toBeGreaterThan(-1);
  await page.getByRole("button", { name: "Break", exact: true }).click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeGreaterThan(-1);
  await page
    .getByRole("button", { name: "USB 3–4 to channel 21/22", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.main)
    .toBeLessThan(-70);
});

test("monitoring blend overrides PFL without changing main or PFL meters", async ({
  page,
}) => {
  await setChannel(page);
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await page
    .getByRole("button", { name: "CH 1 PFL Solo", exact: true })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.phones)
    .toBeGreaterThan(-15);
  await page
    .getByRole("slider", { name: "Inputs / USB 1–2 blend", exact: true })
    .press("End");
  await page
    .getByRole("button", {
      name: "Blend to phones / control room",
      exact: true,
    })
    .click();
  await expect
    .poll(async () => (await read(page)).buses.phones)
    .toBeLessThan(-70);
  expect((await read(page)).left).toBeGreaterThan(-1);
  expect((await read(page)).buses.main).toBeGreaterThan(-8);
  await page.getByText("USB returns & practice tools", { exact: true }).click();
  await page
    .locator(".usb-source")
    .first()
    .getByLabel("Source", { exact: true })
    .selectOption("tone");
  await expect
    .poll(async () => (await read(page)).buses.phones)
    .toBeGreaterThan(-15);
});

test("pointer drag, wheel, keyboard and local settings survive reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load demo band" }).click();
  const knob = page.getByRole("slider", { name: "CH 1 High EQ", exact: true });
  const box = (await knob.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 50, { steps: 6 });
  await page.mouse.up();
  expect(Number(await knob.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  await knob.hover();
  await page.mouse.wheel(0, -80);
  await expect(knob).not.toHaveAttribute("aria-valuenow", "0");
  await page
    .getByRole("textbox", { name: "Channel name", exact: true })
    .fill("My kick");
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem("profx22v3-session-v1")),
    )
    .toContain("My kick");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Channel name", exact: true }),
  ).toHaveValue("My kick");
  await expect(
    page.getByRole("button", { name: "Start audio", exact: true }),
  ).toBeVisible();
  expect((await read(page)).running).toBe(false);
  await page
    .getByRole("slider", { name: "CH 1 High EQ", exact: true })
    .dblclick();
  await expect(
    page.getByRole("spinbutton", { name: "Inspector High EQ", exact: true }),
  ).toHaveValue("0");
});

test("imports remain explicitly missing after reload; a silent file stays silent", async ({
  page,
}) => {
  const wav = Buffer.alloc(44 + 48000 * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await page
    .getByLabel("Import audio file", { exact: true })
    .setInputFiles({ name: "silence.wav", mimeType: "audio/wav", buffer: wav });
  await expect(
    page.getByLabel("Source", { exact: true }).first(),
  ).toContainText("silence.wav");
  await page
    .getByRole("spinbutton", { name: "Inspector Fader", exact: true })
    .fill("0");
  await page.getByRole("button", { name: "Start audio", exact: true }).click();
  await expect.poll(async () => (await read(page)).running).toBe(true);
  expect((await read(page)).buses.main).toBeLessThan(-90);
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem("profx22v3-session-v1")),
    )
    .toContain("silence.wav");
  await page.reload();
  await expect(
    page.getByText("“silence.wav” needs relinking.", { exact: false }),
  ).toBeVisible();
});

test("desktop and mobile preserve panel proportions and accessible controls", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Load demo band" }).click();
  await expect(page.locator(".console-panel img")).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Main fader", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "scratch/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".console-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  const panelBefore = (await page.locator(".console-panel").boundingBox())!;
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const panelAfter = (await page.locator(".console-panel").boundingBox())!;
  expect(panelAfter.width).toBeGreaterThan(panelBefore.width);
  expect(panelAfter.width / panelAfter.height).toBeCloseTo(
    panelBefore.width / panelBefore.height,
    2,
  );
  await page
    .getByRole("button", { name: "Reset console zoom", exact: true })
    .click();
  await page.getByRole("button", { name: "Next channel", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Channel name", exact: true }),
  ).toHaveValue("Snare");
  await page.screenshot({ path: "scratch/mobile.png", fullPage: true });
  await page
    .getByRole("button", { name: "Getting started", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close guide", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
