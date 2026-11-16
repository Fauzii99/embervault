// Regenerate screenshots/ straight from the game's own ?shot= hooks.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shots = JSON.parse(readFileSync('shots.json', 'utf8'));
const base = 'http://127.0.0.1:8131/';
const browser = await chromium.launch({
  executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

for (const shot of shots) {
  await page.goto(base + shot.query, { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 90) lit++;
    return lit > 20000;
  }, { timeout: 20000 });
  await page.waitForTimeout(500);
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: `screenshots/${shot.name}`, type: 'jpeg', quality: 82 });
  console.log('wrote', shot.name, shot.query);
}

await browser.close();
