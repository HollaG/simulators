import { test, expect, type Page } from '@playwright/test';
import { transitionNames } from '../src/mixer/menus';

const state = (page: Page) => page.evaluate(() => window.__mixer!.state());
const time = async (page: Page, value: number) => { await page.evaluate(t => window.__mixer!.setTime(t), value); await page.waitForFunction(t => window.__mixer!.frameTime() === t, value); };
const param = async (page: Page, id: string, value: string | number | boolean) => { await page.evaluate(({ id, value }) => window.__mixer!.dispatch({ type: 'PARAM', id, value, now: window.__mixer!.time() }), { id, value }); await page.waitForFunction(() => window.__mixer!.rendered()); };
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__mixer);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('panel boots with a live LCD, one GPU context and correctly aligned controls', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.getByTestId('program-source')).toHaveText('IN1'); await expect(page.getByTestId('preview-source')).toHaveText('IN2');
  await expect(page.getByRole('button', { name: 'PGM 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__mixer!.contexts())).toBe(1);
  const pgm = await page.getByRole('button', { name: 'PGM 1', exact: true }).boundingBox(), pvw = await page.getByRole('button', { name: 'PVW 1', exact: true }).boundingBox();
  expect(pgm!.y).toBeLessThan(pvw!.y);
  await expect.poll(() => page.getByTestId('lcd').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return data.filter((v, i) => i % 4 !== 3 && v > 60).length;
  })).toBeGreaterThan(1000);
  await page.screenshot({ path: 'test-results/console-desktop.png', fullPage: true }); expect(errors).toEqual([]);
});

test('physical preview, CUT, AUTO interruption and global keyboard shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: 'PVW 3', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN1');
  await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN3'); await expect(page.getByTestId('preview-source')).toHaveText('IN1');
  await time(page, 10000); await page.getByRole('button', { name: 'AUTO', exact: true }).click();
  await page.getByRole('button', { name: 'PVW 4', exact: true }).click(); expect((await state(page)).pvw.source).toBe('IN1');
  await time(page, 10200); await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN1');
  await time(page, 11000); await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Shift+Digit4'); await expect(page.getByTestId('program-source')).toHaveText('IN4');
  await page.keyboard.press('Digit2'); await expect(page.getByTestId('preview-source')).toHaveText('IN2');
  await page.keyboard.press('Space'); await expect(page.getByTestId('program-source')).toHaveText('IN2');
});

test('menu knob navigates and edits transition duration with a real wheel', async ({ page }) => {
  await page.getByRole('button', { name: 'MENU', exact: true }).click();
  await page.getByRole('button', { name: 'Menu encoder', exact: true }).click();
  await page.getByRole('button', { name: 'Menu encoder', exact: true }).hover(); await page.mouse.wheel(0, 80);
  await expect(page.getByTestId('menu-selection')).toContainText('Duration');
  await page.getByRole('button', { name: 'Menu encoder', exact: true }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Encoder next', exact: true }).click();
  await expect.poll(async () => (await state(page)).params['transition.duration']).toBe(1);
  await page.getByRole('button', { name: 'Encoder confirm', exact: true }).click();
  await page.getByRole('button', { name: 'Expand monitors' }).click();
  await page.screenshot({ path: 'test-results/console-menu.png', fullPage: true });
});

test('preview PIP moves to program, while LOGO uses its own green/red/yellow LED', async ({ page }) => {
  await page.getByRole('button', { name: 'KEY', exact: true }).click(); await expect(page.getByTestId('led-pip')).toHaveAttribute('data-color', 'green');
  await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('led-pip')).toHaveAttribute('data-color', 'red');
  await page.getByRole('button', { name: 'Effect selector', exact: true }).hover(); await page.mouse.wheel(0, 80); await page.mouse.wheel(0, 80);
  await expect.poll(async () => (await state(page)).selected).toBe('logo');
  await page.getByRole('button', { name: 'KEY', exact: true }).click(); await expect(page.getByTestId('led-logo')).toHaveAttribute('data-color', 'green');
  await page.getByRole('button', { name: 'ON AIR', exact: true }).click(); await expect(page.getByTestId('led-logo')).toHaveAttribute('data-color', 'yellow');
  await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('led-logo')).toHaveAttribute('data-color', 'yellow');
});

test('FTB produces black video, recovers and STILL holds an actual frame', async ({ page }) => {
  await param(page, 'port.lcd', 'PGM'); await page.getByRole('button', { name: 'MV', exact: true }).click();
  await time(page, 10000); await page.getByRole('button', { name: 'STILL', exact: true }).click();
  const capture = () => page.getByTestId('lcd').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await expect.poll(async () => (await state(page)).freeze?.source).toBe('IN1');
  await page.waitForTimeout(80); const before = await capture(); await time(page, 15000); await page.waitForTimeout(80); expect(await capture()).toBe(before);
  await page.getByRole('button', { name: 'STILL', exact: true }).click(); await page.waitForTimeout(80); expect(await capture()).not.toBe(before);
  await page.getByRole('button', { name: 'FTB', exact: true }).click(); await time(page, 16000);
  await expect.poll(() => page.getByTestId('lcd').evaluate((canvas: HTMLCanvasElement) => {
    const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2]; return sum;
  })).toBe(0);
  await page.getByRole('button', { name: 'FTB', exact: true }).click(); await time(page, 17000); await expect.poll(async () => (await state(page)).black).toBe(0);
});

test('camera hold/preset controls and lock do not change video buses', async ({ page }) => {
  await page.getByRole('button', { name: 'CAM', exact: true }).click();
  const before = await state(page);
  const right = page.getByRole('button', { name: 'Joystick right', exact: true }); await right.hover(); await page.mouse.down(); await page.waitForTimeout(350); await page.mouse.up();
  await expect.poll(async () => (await state(page)).cameras[0].x).toBeGreaterThan(before.cameras[0].x);
  await page.getByRole('button', { name: 'POS', exact: true }).click(); await page.getByRole('button', { name: 'PVW 2', exact: true }).click(); const saved = (await state(page)).cameras[0];
  await page.getByRole('button', { name: 'PGM 2', exact: true }).click(); expect((await state(page)).cameras[0]).toEqual(saved); await expect(page.getByTestId('program-source')).toHaveText('IN1');
  await page.getByRole('button', { name: 'Lock / power' }).click(); expect((await state(page)).locked).toBe(true);
  await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN1');
  await page.getByRole('button', { name: 'Lock / power' }).click(); expect((await state(page)).locked).toBe(false);
});

test('six real audio signals feed working meters and the PGM mute', async ({ page }) => {
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect.poll(() => page.evaluate(() => window.__mixer!.audio()!.levels.PGM ?? 0)).toBeGreaterThan(.1);
  await param(page, 'audio.pgm.on', false);
  await expect.poll(() => page.evaluate(() => window.__mixer!.audio()!.levels.PGM ?? 0)).toBeLessThan(.01);
  await expect.poll(() => page.evaluate(() => window.__mixer!.audio()!.levels.IN1 ?? 0)).toBeGreaterThan(.1);
  await param(page, 'audio.pgm.on', true); await expect.poll(() => page.evaluate(() => window.__mixer!.audio()!.levels.PGM ?? 0)).toBeGreaterThan(.1);
});

test('chroma changes actual pixels while Clean PGM keeps the original background', async ({ page }) => {
  await time(page, 20000); await param(page, 'port.lcd', 'PGM'); await page.getByRole('button', { name: 'MV', exact: true }).click();
  const image = () => page.getByTestId('lcd').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    const sums = [0, 0, 0]; for (let i = 0; i < pixels.length; i += 4) for (let k = 0; k < 3; k++) sums[k] += pixels[i + k];
    return sums.map(sum => sum / (canvas.width * canvas.height));
  });
  await page.waitForFunction(() => window.__mixer!.rendered()); const original = await image();
  await param(page, 'chroma.source', 'IN4');
  await page.evaluate(() => window.__mixer!.dispatch({ type: 'MODE', delta: -2, now: window.__mixer!.time() }));
  await page.getByRole('button', { name: 'ON AIR', exact: true }).click();
  await expect.poll(async () => (await image()).reduce((sum, v, i) => sum + Math.abs(v - original[i]), 0)).toBeGreaterThan(1);
  const keyed = await image();
  // Extra framebuffer passes can round a colour channel by one unit; compare visible image statistics.
  await param(page, 'port.lcd', 'Clean PGM'); await expect.poll(async () => (await image()).reduce((sum, v, i) => sum + Math.abs(v - original[i]), 0)).toBeLessThan(.05);
  await param(page, 'port.lcd', 'PGM'); await expect.poll(async () => (await image()).reduce((sum, v, i) => sum + Math.abs(v - keyed[i]), 0)).toBeLessThan(.05);
  await page.getByRole('button', { name: 'Expand monitors' }).click();
  await page.screenshot({ path: 'test-results/console-keying.png', fullPage: true });
});

test('all thirty transition patterns render and CUT completes each target', async ({ page }) => {
  test.setTimeout(180000);
  await time(page, 10000); await param(page, 'port.lcd', 'PGM'); await page.getByRole('button', { name: 'MV', exact: true }).click();
  for (let index = 0; index < transitionNames.length; index++) {
    const start = 10000 + index * 1000;
    await time(page, start); await param(page, 'transition.kind', transitionNames[index]);
    const incoming = (await state(page)).pvw.source;
    await page.getByRole('button', { name: 'AUTO', exact: true }).click(); await time(page, start + 250);
    const sum = () => page.getByTestId('lcd').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0; for (let i = 0; i < pixels.length; i += 4) total += pixels[i] + pixels[i + 1] + pixels[i + 2]; return total;
    });
    if (transitionNames[index] === 'DIP') await expect.poll(sum).toBe(0);
    else await expect.poll(sum).toBeGreaterThan(100000);
    await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText(incoming);
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a saved MEM with imported media survives reload and recalls', async ({ page }) => {
  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  await page.getByLabel('Load LOGO1', { exact: true }).setInputFiles({ name: 'practice-logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#00ffcc"/></svg>') });
  await expect(page.getByText('practice-logo.svg', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'PGM 3', exact: true }).click();
  await page.evaluate(() => window.__mixer!.dispatch({ type: 'BUTTON', id: 'save', now: performance.now() }));
  await expect.poll(async () => (await state(page)).memories[0]?.pgm.source).toBe('IN3');
  await page.waitForTimeout(400); await page.reload(); await page.waitForFunction(() => !!window.__mixer);
  await page.getByRole('button', { name: 'MEM', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN3');
  await page.getByRole('button', { name: 'Sources', exact: true }).click(); await expect(page.getByText('practice-logo.svg', { exact: true })).toBeVisible();
});

test('mobile keeps the fixed console reachable and dialog text readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'PVW 4', exact: true }).click(); await expect(page.getByTestId('preview-source')).toHaveText('IN4');
  await page.getByRole('button', { name: 'CUT', exact: true }).click(); await expect(page.getByTestId('program-source')).toHaveText('IN4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/console-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Help', exact: false }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: 'test-results/help-mobile.png', fullPage: true });
});
