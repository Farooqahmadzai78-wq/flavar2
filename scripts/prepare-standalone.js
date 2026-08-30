import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const publicDir = path.resolve('.output/public');
const assetsDir = path.join(publicDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error('Directory .output/public/assets does not exist. Please run vite build first.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const cssFile = files.find((f) => f.startsWith('styles-') && f.endsWith('.css'));
const jsEntry = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));

if (!jsEntry) {
  console.error('Could not find main index-*.js bundle in .output/public/assets');
  process.exit(1);
}

const htmlContent = `<!DOCTYPE html>
<html lang="fr" class="notranslate" translate="no">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <title>Islam Noor</title>
  <meta name="description" content="Application islamique complète : Heures de prière, Adhan, Coran, Qibla, Tasbih et Scanner Halal." />
  <meta name="theme-color" content="#0F766E" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="icon" href="/favicon.ico" />
  ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ''}
  <style>
    /* Prevent pull-to-refresh and bounce on mobile */
    html, body {
      overscroll-behavior-y: none;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      -webkit-user-select: none;
    }
  </style>
</head>
<body class="bg-background text-foreground antialiased selection:bg-emerald-500/20 selection:text-emerald-700 min-h-screen">
  <div id="root"></div>
  <script type="module" src="/assets/${jsEntry}"></script>
</body>
</html>
`;

const targetHtml = path.join(publicDir, 'index.html');
fs.writeFileSync(targetHtml, htmlContent, 'utf-8');
console.log(`[Islam Noor] Generated standalone offline index.html -> ${targetHtml}`);

try {
  console.log('[Islam Noor] Running Capacitor sync for Android...');
  execSync('npx cap sync android', { stdio: 'inherit' });
  console.log('[Islam Noor] Android sync completed successfully.');
} catch (err) {
  console.error('[Islam Noor] Capacitor sync error:', err);
}
