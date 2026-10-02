// Generate a printable sheet of QR anchors for a site.
//
//   npm run anchors -- <siteId> --base https://your-stable-host
//
// Every waypoint with type "anchor" in data/sites/<siteId>/waypoints.csv gets a card whose QR
// encodes <base>/ar?site=<siteId>&node=<docId>. Use a stable deployed host: a phone's camera
// app opens this URL directly, and a quick-tunnel URL changes on every run.
// Writes data/sites/<siteId>/anchors.html — open it in a browser and print at 100% scale.
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { loadSite, siteDir, waypointDocId } from './site-data';

const args = process.argv.slice(2);
const siteId = args.find(a => !a.startsWith('--'));
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? args[baseIdx + 1]?.replace(/\/$/, '') : undefined;

if (!siteId || !base || !/^https:\/\//.test(base)) {
  console.error('Usage: npm run anchors -- <siteId> --base https://your-stable-host');
  process.exit(1);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function main() {
  const { config, waypoints, errors } = loadSite(siteId!);
  if (errors.length) {
    console.error(`Fix data/sites/${siteId} first (npm run import-site -- ${siteId} --dry-run).`);
    process.exit(1);
  }
  const anchors = waypoints.filter(w => w.type === 'anchor');
  if (!anchors.length) {
    console.error('No waypoints with type "anchor".');
    process.exit(1);
  }

  const cards = await Promise.all(anchors.map(async a => {
    const url = `${base}/ar?site=${encodeURIComponent(siteId!)}&node=${encodeURIComponent(waypointDocId(siteId!, a.node_id))}`;
    // Error correction "Q" tolerates ~25% damage — useful for laminated codes that get scuffed.
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 2 });
    return `
    <section class="card">
      ${svg}
      <h2>${escapeHtml(a.name || a.node_id)}</h2>
      <p class="site">${escapeHtml(config.name)}</p>
      <p class="hint">Scan to navigate — no app needed</p>
      <dl>
        <dt>Anchor</dt><dd>${escapeHtml(a.node_id)}</dd>
        <dt>Scanner faces</dt><dd>${a.anchor_map_bearing_deg}° map${config.north_offset_deg !== null
          ? ` (${(((a.anchor_map_bearing_deg! + config.north_offset_deg) % 360) + 360) % 360}° true)` : ''}</dd>
        <dt>Position</dt><dd>x ${a.x} m, y ${a.y} m${a.floor !== null ? `, floor ${a.floor}` : ''}</dd>
      </dl>
      <p class="url">${escapeHtml(url)}</p>
    </section>`;
  }));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>QR anchors — ${escapeHtml(config.name)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #000; background: #fff; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .card { border: 1px dashed #999; padding: 6mm; text-align: center; break-inside: avoid; }
  .card svg { width: 60mm; height: 60mm; }
  h2 { margin: 2mm 0 0; font-size: 16pt; }
  .site { margin: 1mm 0; font-size: 11pt; }
  .hint { margin: 1mm 0 3mm; font-size: 10pt; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 0 3mm; text-align: left; font-size: 8pt; margin: 0 auto; width: max-content; }
  dt { font-weight: 600; }
  dd { margin: 0; }
  .url { font: 6pt monospace; word-break: break-all; color: #555; margin-top: 2mm; }
</style>
</head>
<body>
<div class="sheet">${cards.join('')}
</div>
</body>
</html>
`;
  const out = path.join(siteDir(siteId!), 'anchors.html');
  fs.writeFileSync(out, html);
  console.log(`Wrote ${anchors.length} anchors to ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
