#!/usr/bin/env node
/**
 * Lipa Research Article Scaffolder
 *
 * Generates a new research article HTML file from a template,
 * pre-filled with metadata you specify.
 *
 * Usage:
 *   node scripts/scaffold-article.js <slug> "<title>" "<category>" "<description>"
 *
 * Example:
 *   node scripts/scaffold-article.js apob-vs-ldl "ApoB vs LDL cholesterol: the marker your doctor doesn't order" "Cardiovascular" "Why ApoB is increasingly viewed as a more accurate predictor of cardiovascular risk than LDL-C."
 *
 * Output:
 *   Creates /research-apob-vs-ldl.html with the full article template,
 *   ready for you to fill in the body content and citations.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Usage: node scripts/scaffold-article.js <slug> "<title>" [category] [description]

Example:
  node scripts/scaffold-article.js apob-vs-ldl "ApoB vs LDL: the marker your doctor doesn't order" "Cardiovascular" "Why ApoB matters more than LDL-C."

This creates: /research-apob-vs-ldl.html
`);
  process.exit(1);
}

const slug = args[0];
const title = args[1];
const category = args[2] || 'Biomarker';
const description = args[3] || `A plain-English deep dive on ${title.split(':')[0] || title}.`;
const today = new Date().toISOString().split('T')[0];
const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const outputPath = path.join(REPO_ROOT, `research-${slug}.html`);

if (fs.existsSync(outputPath)) {
  console.error(`\n  ERROR: ${outputPath} already exists. Choose a different slug.\n`);
  process.exit(1);
}

const template = `<!DOCTYPE html>
<html lang="en" translate="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="google" content="notranslate">
  <title>${title} | Lipa</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="https://lipa.health/research-${slug}.html">

  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'><circle cx='14' cy='14' r='13' fill='none' stroke='%231B6B4A' stroke-width='1.5'/><path d='M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z' fill='%231B6B4A' opacity='0.3' stroke='%231B6B4A' stroke-width='1'/></svg>">

  <meta property="og:title" content="${title} — Lipa">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://lipa.health/research-${slug}.html">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title.replace(/"/g, '\\"')}",
    "description": "${description.replace(/"/g, '\\"')}",
    "datePublished": "${today}",
    "dateModified": "${today}",
    "author": {"@type": "Organization", "name": "Lipa Health", "url": "https://lipa.health"},
    "publisher": {"@type": "Organization", "name": "Lipa Health", "url": "https://lipa.health"}
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://lipa.health/"},
      {"@type": "ListItem", "position": 2, "name": "Research", "item": "https://lipa.health/research.html"},
      {"@type": "ListItem", "position": 3, "name": "${title.split(':')[0]}"}
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    :root { --white: #FFFFFF; --cream: #F8F5EF; --ink: #0F1A15; --text: #0F1A15; --text-secondary: #5A635D; --text-tertiary: #8A928C; --accent: #1B6B4A; --accent-light: #E8F0EA; --accent-hover: #155A3D; --border: rgba(15,26,21,0.08); --border-strong: rgba(15,26,21,0.14); --ink-text-dim: rgba(255,255,255,0.62); --ink-border: rgba(255,255,255,0.08); }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
    body { background: var(--white); color: var(--text); font-family: 'Inter', -apple-system, sans-serif; font-size: 17px; line-height: 1.7; overflow-x: hidden; }
    a { color: inherit; text-decoration: none; }
    nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 18px 40px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.85); backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--border); }
    .logo { font-size: 16px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; display: flex; align-items: center; gap: 10px; color: var(--text); }
    .logo-icon { width: 26px; height: 26px; }
    .nav-right { display: flex; align-items: center; gap: 28px; }
    .nav-links { display: flex; gap: 28px; font-size: 13px; font-weight: 500; }
    .nav-links a { color: var(--text-secondary); } .nav-links a:hover { color: var(--text); } .nav-links a.active { color: var(--text); font-weight: 600; }
    .nav-cta { font-size: 13px; font-weight: 600; color: var(--white); background: var(--accent); padding: 10px 22px; border-radius: 980px; }
    .article-hero { background: var(--cream); padding: 160px 40px 80px; border-bottom: 1px solid var(--border); }
    .article-container { max-width: 760px; margin: 0 auto; }
    .breadcrumb { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); margin-bottom: 28px; }
    .breadcrumb a { color: var(--text-secondary); } .breadcrumb .sep { margin: 0 10px; }
    .article-tag { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); margin-bottom: 20px; }
    .article-title { font-family: 'Fraunces', Georgia, serif; font-size: clamp(36px, 5vw, 60px); font-weight: 400; line-height: 1.04; letter-spacing: -0.025em; margin-bottom: 28px; }
    .article-deck { font-size: clamp(17px, 1.5vw, 21px); line-height: 1.55; color: var(--text-secondary); margin-bottom: 36px; max-width: 680px; }
    .article-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); padding-top: 24px; border-top: 1px solid var(--border); display: flex; gap: 24px; flex-wrap: wrap; }
    .article-meta strong { color: var(--text); font-weight: 500; }
    .article-body { padding: 80px 40px 40px; }
    .article-body h2 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(28px, 3vw, 36px); font-weight: 500; line-height: 1.15; margin: 64px 0 24px; }
    .article-body h2:first-child { margin-top: 0; }
    .article-body h3 { font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 500; margin: 40px 0 16px; }
    .article-body p { font-size: 17px; line-height: 1.75; margin-bottom: 22px; }
    .article-body p strong { font-weight: 600; }
    .article-body ul, .article-body ol { margin: 0 0 24px 24px; }
    .article-body li { font-size: 17px; line-height: 1.75; margin-bottom: 8px; }
    .article-body .pull-quote { font-family: 'Fraunces', Georgia, serif; font-size: clamp(22px, 2.4vw, 28px); font-weight: 500; line-height: 1.3; margin: 48px 0; padding: 32px 0 32px 32px; border-left: 3px solid var(--accent); }
    .article-body .cite { color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; vertical-align: super; line-height: 0; margin-left: 2px; }
    .article-body .cite a { color: var(--accent); border-bottom: 1px solid rgba(27,107,74,0.3); }
    .keypoint { background: var(--cream); border-left: 3px solid var(--accent); border-radius: 0 12px 12px 0; padding: 24px 28px; margin: 36px 0; }
    .keypoint-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
    .keypoint-text { font-size: 16px; line-height: 1.65; }
    .references { background: var(--cream); padding: 80px 40px; border-top: 1px solid var(--border); }
    .references-inner { max-width: 760px; margin: 0 auto; }
    .references h2 { font-family: 'Fraunces', Georgia, serif; font-size: 32px; font-weight: 500; margin-bottom: 32px; }
    .ref-list { counter-reset: ref-counter; }
    .ref-item { counter-increment: ref-counter; padding: 16px 0; border-bottom: 1px solid var(--border); display: grid; grid-template-columns: 36px 1fr; gap: 14px; font-size: 13px; line-height: 1.5; }
    .ref-item:last-child { border-bottom: none; }
    .ref-item::before { content: counter(ref-counter); font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent); font-weight: 600; }
    .ref-title { color: var(--text); font-weight: 500; }
    .ref-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
    .ref-meta .ref-pmid { color: var(--accent); } .ref-meta .ref-pmid a { color: var(--accent); border-bottom: 1px solid rgba(27,107,74,0.3); }
    .ref-meta .ref-grade { font-weight: 600; background: var(--accent-light); color: var(--accent); padding: 2px 8px; border-radius: 999px; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; }
    .article-cta { background: var(--ink); color: var(--white); padding: 100px 40px; text-align: center; }
    .article-cta h2 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(32px, 4vw, 48px); font-weight: 400; line-height: 1.1; color: var(--white); margin-bottom: 24px; max-width: 620px; margin-left: auto; margin-right: auto; }
    .article-cta p { font-size: 17px; line-height: 1.6; color: var(--ink-text-dim); max-width: 560px; margin: 0 auto 40px; }
    .btn-primary { display: inline-block; font-size: 14px; font-weight: 600; color: var(--white); background: var(--accent); padding: 18px 36px; border-radius: 980px; box-shadow: 0 6px 24px rgba(27,107,74,0.18); }
    footer.page-footer { background: var(--ink); color: var(--ink-text-dim); padding: 48px 40px; font-size: 12px; text-align: center; border-top: 1px solid var(--ink-border); }
    footer.page-footer a { color: var(--ink-text-dim); margin: 0 16px; } footer.page-footer a:hover { color: var(--white); }
    @media (max-width: 900px) { nav { padding: 14px 20px; } .nav-links { display: none; } .article-hero { padding: 120px 20px 56px; } .article-body { padding: 56px 20px 32px; } .references { padding: 60px 20px; } .article-cta { padding: 64px 20px; } }
  </style>
</head>
<body>

<nav>
  <a href="/" class="logo">
    <svg class="logo-icon" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="13" stroke="#1B6B4A" stroke-width="1.5"/><path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15"/><path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" stroke="#1B6B4A" stroke-width="1.2"/><line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" stroke-width="0.8"/></svg>
    Lipa
  </a>
  <div class="nav-right">
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/methodology.html">Our methodology</a>
      <a href="/research.html" class="active">Research</a>
    </div>
    <a href="/#join" class="nav-cta">Join the waitlist</a>
  </div>
</nav>

<section class="article-hero">
  <div class="article-container">
    <div class="breadcrumb"><a href="/">Home</a><span class="sep">/</span><a href="/research.html">Research</a><span class="sep">/</span>${title.split(':')[0]}</div>
    <div class="article-tag">${category}</div>
    <h1 class="article-title">${title}</h1>
    <p class="article-deck">${description}</p>
    <div class="article-meta">
      <span><strong>X min read</strong></span>
      <span><strong>X</strong> cited studies</span>
      <span>Last reviewed <strong>${monthYear}</strong></span>
    </div>
  </div>
</section>

<article class="article-body">
  <div class="article-container">

    <h2>Section heading</h2>
    <p>Article body goes here. Replace this with the actual content.</p>

    <div class="keypoint">
      <div class="keypoint-label">Key finding</div>
      <div class="keypoint-text">Replace with key finding text.</div>
    </div>

    <h2>Another section</h2>
    <p>More content here. Use <span class="cite">[1]</span> for inline citations.</p>

    <div class="pull-quote">Replace with a pull-quote from the research.</div>

  </div>
</article>

<section class="references">
  <div class="references-inner">
    <h2>Cited research</h2>
    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 24px;">All citations link to the source publication. See <a href="/methodology.html" style="color: var(--accent); border-bottom: 1px solid rgba(27,107,74,0.3);">our methodology</a> for grading details.</p>
    <ol class="ref-list">
      <li class="ref-item">
        <div>
          <div class="ref-title">Author A, Author B. Study title here.</div>
          <div class="ref-meta">
            <span>Journal · Year</span>
            <span class="ref-pmid"><a href="https://pubmed.ncbi.nlm.nih.gov/XXXXXXXX/">PMID: XXXXXXXX</a></span>
            <span class="ref-grade">Grade A</span>
            <span>Independent · academic</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</section>

<section class="article-cta">
  <h2>Upload your blood test. See the research.</h2>
  <p>Lipa reads every marker, cross-references the research, and gives you the full analysis — cited, plain-English, with an action plan. No test markup.</p>
  <a href="/#join" class="btn-primary">Join the waitlist</a>
</section>

<footer class="page-footer">
  <div>
    <a href="/">Home</a>
    <a href="/methodology.html">Our methodology</a>
    <a href="/research.html">Research</a>
    <a href="/privacy.html">Privacy</a>
  </div>
  <div style="margin-top: 16px; opacity: 0.5;">Lipa Health &copy; 2026</div>
</footer>

</body>
</html>`;

fs.writeFileSync(outputPath, template, 'utf8');
console.log(`\n  ✓ Created: ${outputPath}\n  Title: "${title}"\n  Category: ${category}\n  Ready to fill in body content + citations.\n`);
