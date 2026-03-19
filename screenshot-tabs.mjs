import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'screenshots');

const tabs = [
  { name: 'home', label: '홈' },
  { name: 'calendar', label: '교번' },
  { name: 'line', label: '5호선' },
  { name: 'duty', label: '근무' },
  { name: 'exchange', label: '교체' },
  { name: 'more', label: '설정' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // First load to set localStorage
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    // Zustand persist format for driver store (key: 'dp')
    localStorage.setItem('dp', JSON.stringify({
      state: {
        current: {
          I: '0',
          d: '20240101',
          n: '이진호',
          s: '21711694'
        }
      },
      version: 0
    }));
  });

  // Reload to apply auth
  await page.reload();
  await page.waitForTimeout(2000);

  for (const tab of tabs) {
    // Find and click the tab button in bottom nav
    const tabBtn = page.locator('button, a').filter({ hasText: new RegExp(`^${tab.label}$`) });
    const count = await tabBtn.count();
    if (count > 0) {
      await tabBtn.last().click({ force: true });
      await page.waitForTimeout(1500);
    }

    await page.screenshot({
      path: path.join(outDir, `${tab.name}.png`),
      fullPage: false
    });
    console.log(`✓ ${tab.name} (${tab.label})`);
  }

  await browser.close();
  console.log('Done!');
})();
