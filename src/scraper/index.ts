import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

async function scrape() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: true, // Use boolean for compatibility
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const url = 'https://www.tradingview.com/pine-script-reference/v6/';
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  console.log('Waiting for symbols list...');
  await page.waitForSelector('a[href^="#fun_"], a[href^="#var_"]', { timeout: 30000 });

  console.log('Extracting symbols...');
  const symbols = await page.evaluate(() => {
    const results: { name: string; href: string }[] = [];
    const links = Array.from(document.querySelectorAll('a[href^="#"]'));
    
    links.forEach(link => {
      const element = link as HTMLAnchorElement;
      const href = element.getAttribute('href') || '';
      if (!href.startsWith('#fun_') && !href.startsWith('#var_') && !href.startsWith('#kw_') && !href.startsWith('#type_')) {
        return;
      }
      
      const name = element.textContent?.trim() || '';
      if (!name) return;

      results.push({ name, href });
    });
    return results;
  });

  console.log(`Found ${symbols.length} symbols. Processing...`);

  const referenceIndex: Record<string, any> = {};

  for (const s of symbols) {
    let kind = 'unknown';
    if (s.href.startsWith('#fun_')) kind = 'function';
    else if (s.href.startsWith('#var_')) kind = 'variable';
    else if (s.href.startsWith('#kw_')) kind = 'keyword';
    else if (s.href.startsWith('#type_')) kind = 'type';

    referenceIndex[s.name] = {
      kind,
      path: s.href,
      summary: `Pine Script v6 ${kind}: ${s.name}` // Placeholder summary
    };
  }

  const outputPath = path.join(__dirname, '..', '..', 'src', 'references', 'pine.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(referenceIndex, null, 2));
  
  console.log(`Successfully saved ${Object.keys(referenceIndex).length} symbols to ${outputPath}`);
  await browser.close();
}

scrape().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});