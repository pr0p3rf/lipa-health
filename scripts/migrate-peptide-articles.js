#!/usr/bin/env node
/**
 * Migrate the legacy peptide-era research articles into the new Lipa
 * navigation + footer.
 *
 * Run from the repo root:
 *     node scripts/migrate-peptide-articles.js
 *
 * This script is intentionally surgical:
 *  - Replaces the <nav>…</nav> contents with the new nav (Home, Methodology,
 *    Research [active], Join the waitlist CTA).
 *  - Replaces the <footer>…</footer> contents with the new footer (no Go Exe
 *    B.V. mention; new link list).
 *  - Loads Fraunces and JetBrains Mono alongside Inter and Instrument Serif so
 *    future inline serif/mono enhancements work without further font wiring.
 *  - Leaves all article body content, hero, TOC, citations, and styling intact.
 *
 * Targets: every file in the repo root matching `research-*.html`.
 * Skips: `research.html` (the new content library landing page).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const NEW_NAV_INNER = `    <a href="/" class="logo">
      <svg class="logo-icon" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" stroke="#1B6B4A" stroke-width="1.5"/>
        <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15"/>
        <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" stroke="#1B6B4A" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" stroke-width="0.8"/>
      </svg>
      Lipa
    </a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/methodology.html">Our methodology</a>
      <a href="/research.html" class="active">Research</a>
    </div>
    <a href="/#join" class="nav-cta">Join the waitlist</a>`;

const NEW_FOOTER_INNER = `    <div class="footer-left">&copy; 2026 Lipa Health. All rights reserved.</div>
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="/methodology.html">Methodology</a>
      <a href="/research.html">Research</a>
      <a href="/privacy.html">Privacy</a>
    </div>`;

const NEW_FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

function migrateFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  const changes = [];

  // 1) Replace <nav>…</nav> contents
  const navRegex = /(<nav>)([\s\S]*?)(<\/nav>)/;
  if (navRegex.test(content)) {
    content = content.replace(navRegex, `$1\n${NEW_NAV_INNER}\n  $3`);
    changes.push('nav');
  }

  // 2) Replace <footer>…</footer> contents
  const footerRegex = /(<footer>)([\s\S]*?)(<\/footer>)/;
  if (footerRegex.test(content)) {
    content = content.replace(footerRegex, `$1\n${NEW_FOOTER_INNER}\n  $3`);
    changes.push('footer');
  }

  // 3) Update Google Fonts link to also load Fraunces + JetBrains Mono
  const oldFontLinkRegex = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*" rel="stylesheet">/;
  if (oldFontLinkRegex.test(content)) {
    content = content.replace(oldFontLinkRegex, NEW_FONT_LINK);
    changes.push('fonts');
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, changes };
  }

  return { ok: false, changes: [] };
}

function main() {
  const allFiles = fs.readdirSync(REPO_ROOT);
  const targets = allFiles.filter(
    (f) => /^research-.+\.html$/.test(f) && f !== 'research.html'
  );

  console.log(`\nMigrating ${targets.length} legacy peptide research articles…\n`);

  let migrated = 0;
  let skipped = 0;
  const results = [];

  for (const file of targets) {
    const fullPath = path.join(REPO_ROOT, file);
    const result = migrateFile(fullPath);
    if (result.ok) {
      migrated++;
      results.push(`  ✓ ${file}  (${result.changes.join(', ')})`);
    } else {
      skipped++;
      results.push(`  ✗ ${file}  (no changes — selectors did not match)`);
    }
  }

  console.log(results.join('\n'));
  console.log(`\nDone. Migrated: ${migrated}. Skipped: ${skipped}.\n`);
}

main();
