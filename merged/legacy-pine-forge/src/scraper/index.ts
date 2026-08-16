import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface PineParam {
  name: string;
  type?: string;
  description: string;
  optional?: boolean;
}

interface RichEntry {
  kind: string;
  path: string;
  summary: string;
  description?: string;
  syntax?: string[];
  params?: PineParam[];
  returns?: string;
  example?: string;
  remarks?: string;
}

async function scrape() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const url = 'https://www.tradingview.com/pine-script-reference/v6/';

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });

  console.log('Waiting for reference content...');
  await page.waitForSelector('a[href^="#fun_"], a[href^="#var_"]', { timeout: 30000 });

  // Give SPA extra time to render all sections
  await new Promise(r => setTimeout(r, 2000));

  console.log('Extracting all reference sections...');

  const referenceIndex: Record<string, RichEntry> = await page.evaluate(() => {
    const index: Record<string, any> = {};

    function kindFromHref(href: string): string {
      if (href.startsWith('#fun_')) return 'function';
      if (href.startsWith('#var_')) return 'variable';
      if (href.startsWith('#kw_')) return 'keyword';
      if (href.startsWith('#type_')) return 'type';
      return 'unknown';
    }

    function cleanText(el: Element | null | undefined): string {
      return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }

    /**
     * Within a .tv-pine-reference-item__content element, gather all children
     * and split them by .tv-pine-reference-item__sub-header labels.
     * Returns a map of label → array of sibling elements that follow it.
     */
    function sectionMap(content: Element): Record<string, Element[]> {
      const map: Record<string, Element[]> = {};
      let current: string | null = null;

      for (const child of Array.from(content.children)) {
        if (child.classList.contains('tv-pine-reference-item__sub-header')) {
          current = child.textContent?.trim().toLowerCase() ?? null;
          if (current) map[current] = [];
        } else if (current) {
          map[current].push(child);
        } else {
          // Before first sub-header — description
          if (!map['__desc__']) map['__desc__'] = [];
          map['__desc__'].push(child);
        }
      }
      return map;
    }

    function parseParams(argEls: Element[]): PineParam[] {
      const params: PineParam[] = [];
      for (const el of argEls) {
        const typeSpan = el.querySelector('.tv-pine-reference-item__arg-type');
        if (!typeSpan) continue;

        const typeRaw = typeSpan.textContent?.trim() ?? '';
        // Format: "name (type) " or "name? (type) "
        const m = typeRaw.match(/^(\w[\w.]*)\??\s*\(([^)]*)\)/);
        const name = m ? m[1] : typeRaw.replace(/[()]/g, '').trim();
        const type = m ? m[2].trim() : undefined;
        const optional = typeRaw.includes('?');

        // Description is the text node after the span
        const fullText = el.textContent?.trim() ?? '';
        const description = fullText.replace(typeRaw, '').trim();

        if (name) params.push({ name, type, description, optional: optional || undefined });
      }
      return params;
    }

    function deduplicateSyntax(lines: string[]): string[] {
      // Collapse overloads that differ only in Pine qualifier (const/input/simple/series)
      // e.g. "math.round(number) → const int" and "math.round(number) → series int"
      // become "math.round(number) → int"
      const seen = new Set<string>();
      const result: string[] = [];
      for (const line of lines) {
        const normalized = line.replace(/\b(const|input|simple|series)\s+/g, '');
        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(normalized);
        }
      }
      return result;
    }

    // Collect all anchor links
    const links = Array.from(
      document.querySelectorAll('a[href^="#fun_"], a[href^="#var_"], a[href^="#kw_"], a[href^="#type_"]')
    ) as HTMLAnchorElement[];

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const rawName = link.textContent?.trim() || '';
      const name = rawName.replace(/\(\)$/, ''); // strip trailing () from function names
      if (!name || !href) continue;

      const kind = kindFromHref(href);
      const anchorId = href.slice(1); // strip leading #

      const section = document.getElementById(anchorId);
      const entry: any = {
        kind,
        path: href,
        summary: `Pine Script v6 ${kind}: ${name}`,
      };

      if (section) {
        const content = section.querySelector('.tv-pine-reference-item__content');
        if (content) {
          const smap = sectionMap(content);

          // Description: first .tv-pine-reference-item__text before any sub-header
          const descEls = smap['__desc__'] ?? [];
          const descEl = descEls.find(e => e.classList.contains('tv-pine-reference-item__text'));
          if (descEl) {
            const desc = cleanText(descEl);
            if (desc && desc.length > 5) {
              entry.description = desc;
              entry.summary = desc;
            }
          }

          // Syntax: all <pre class="tv-pine-reference-item__syntax">
          const syntaxEls = content.querySelectorAll('pre.tv-pine-reference-item__syntax');
          if (syntaxEls.length > 0) {
            const rawLines = Array.from(syntaxEls).map(e => e.textContent?.trim() ?? '').filter(Boolean);
            const deduplicated = deduplicateSyntax(rawLines);
            if (deduplicated.length > 0) entry.syntax = deduplicated;
          }

          // Params: elements after "arguments" sub-header
          const argKey = Object.keys(smap).find(k => k.includes('argument'));
          if (argKey) {
            const params = parseParams(smap[argKey]);
            if (params.length > 0) entry.params = params;
          }

          // Returns
          const retKey = Object.keys(smap).find(k => k.startsWith('return'));
          if (retKey && smap[retKey].length > 0) {
            const ret = cleanText(smap[retKey][0]);
            if (ret) entry.returns = ret;
          }

          // Example
          const exKey = Object.keys(smap).find(k => k.startsWith('example'));
          if (exKey && smap[exKey].length > 0) {
            const codeEl = smap[exKey][0].querySelector('pre, code') ?? smap[exKey][0];
            const ex = codeEl.textContent?.trim();
            if (ex) entry.example = ex;
          }

          // Remarks
          const remKey = Object.keys(smap).find(k => k.startsWith('remark') || k === 'note' || k === 'notes');
          if (remKey && smap[remKey].length > 0) {
            const rem = cleanText(smap[remKey][0]);
            if (rem) entry.remarks = rem;
          }
        }
      }

      // Avoid duplicates — keep first occurrence
      if (!index[name]) {
        index[name] = entry;
      }
    }

    return index;
  });

  const total = Object.keys(referenceIndex).length;
  let withDesc = 0, withParams = 0, withReturns = 0, withExample = 0, withSyntax = 0;
  for (const e of Object.values(referenceIndex)) {
    if (e.description) withDesc++;
    if (e.params && e.params.length > 0) withParams++;
    if (e.returns) withReturns++;
    if (e.example) withExample++;
    if (e.syntax && e.syntax.length > 0) withSyntax++;
  }
  console.log(`Extracted ${total} symbols.`);
  console.log(`Coverage — syntax: ${withSyntax}, description: ${withDesc}, params: ${withParams}, returns: ${withReturns}, example: ${withExample}`);

  const outputPath = path.join(__dirname, '..', '..', 'src', 'references', 'pine.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(referenceIndex, null, 2));

  console.log(`Saved to ${outputPath}`);
  await browser.close();
}

scrape().catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
