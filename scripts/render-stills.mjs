// Renders the campus stills used on weak devices and with reduced motion:
// public/campus/<phase>-<layout>.webp for dawn, day, sunset and night, wide and phone.
// Run after `npm run build`:  node scripts/render-stills.mjs [outDir]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openApp, startServer } from '../tests/e2e/harness.mjs';

const out = process.argv[2] ?? 'public/campus';
mkdirSync(out, { recursive: true });
const SIZES = { wide: [1600, 900], phone: [800, 1400] };
const server = await startServer();
const browser = await launch();
try {
  for (const phase of ['dawn', 'day', 'sunset', 'night']) {
    for (const [layout, [w, h]] of Object.entries(SIZES)) {
      const viewport = layout === 'phone' ? { width: 400, height: 700 } : { width: w, height: h };
      const { page, context } = await openApp(browser, {}, { lang: 'ar', reducedMotion: 'no-preference', query: `?still=1&3d=1&sky=${phase}`, viewport, snap: true });
      await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
      await page.waitForTimeout(4000);
      const png = join(out, `${phase}-${layout}.png`);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.screenshot({ path: png, scale: 'device' });
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', `scale=${w}:-2`, '-quality', '78', join(out, `${phase}-${layout}.webp`)]);
      rmSync(png);
      await context.close();
      console.log(phase, layout);
    }
  }
} finally {
  await browser.close();
  server.kill();
}
