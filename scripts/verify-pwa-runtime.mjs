import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

const failures = [];
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(`console.error: ${message.text()}`);
});

try {
  const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
  if (!response || !response.ok()) {
    throw new Error(`PWA root returned ${response?.status() ?? 'no response'}`);
  }

  await page.waitForSelector('canvas', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => ({
    title: document.title,
    canvasCount: document.querySelectorAll('canvas').length,
    bodyTextLength: document.body?.innerText?.length ?? 0,
    readyState: document.readyState,
  }));

  if (result.canvasCount < 1) throw new Error('PWA runtime mounted without a canvas');
  if (result.readyState !== 'complete') throw new Error(`document not complete: ${result.readyState}`);
  if (failures.length) throw new Error(failures.join(' | '));

  console.log(JSON.stringify({ ok: true, baseUrl, ...result }));
} finally {
  await browser.close();
}
