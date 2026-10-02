// Shared helpers for the site data scripts: CSV I/O and loading data/sites/<siteId>/.
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(__dirname, '../../data');
export const siteDir = (siteId: string) => path.join(DATA_DIR, 'sites', siteId);

/** Minimal RFC 4180 parser: quoted fields, embedded commas/quotes/newlines. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const [header, ...body] = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!header) return [];
  const keys = header.map(h => h.trim());
  return body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\n') + '\n';
}

export interface SiteConfig {
  site_id: string;
  name: string;
  /** True bearing of the map's +y axis, degrees clockwise from true north. */
  north_offset_deg: number | null;
  /** Magnetic declination at the site (east positive); true = magnetic + declination. */
  magnetic_declination_deg: number | null;
}

export interface SiteWaypoint {
  node_id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  floor: number | null;
  neighbors: string[];
  anchor_map_bearing_deg: number | null;
  notes: string;
}

const optNumber = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));

export function loadSite(siteId: string): { config: SiteConfig; waypoints: SiteWaypoint[]; errors: string[] } {
  const dir = siteDir(siteId);
  const config: SiteConfig = JSON.parse(fs.readFileSync(path.join(dir, 'site.json'), 'utf8'));
  const raw = parseCsv(fs.readFileSync(path.join(dir, 'waypoints.csv'), 'utf8'));
  const errors: string[] = [];
  if (config.site_id !== siteId) errors.push(`site.json site_id "${config.site_id}" != folder name "${siteId}"`);

  const waypoints: SiteWaypoint[] = raw.map((r, i) => {
    const line = i + 2;
    const w: SiteWaypoint = {
      node_id: r.node_id,
      name: r.name ?? '',
      type: r.type || 'path',
      x: Number(r.x),
      y: Number(r.y),
      z: optNumber(r.z) ?? 0,
      floor: optNumber(r.floor),
      neighbors: (r.neighbors ?? '').split(';').map(s => s.trim()).filter(Boolean),
      anchor_map_bearing_deg: optNumber(r.anchor_map_bearing_deg),
      notes: r.notes ?? '',
    };
    if (!w.node_id) errors.push(`line ${line}: missing node_id`);
    else if (!/^[A-Za-z0-9_-]+$/.test(w.node_id)) errors.push(`line ${line}: node_id "${w.node_id}" may only use letters, digits, _ and -`);
    if (!Number.isFinite(w.x) || !Number.isFinite(w.y) || !Number.isFinite(w.z)) errors.push(`line ${line} (${w.node_id}): x/y/z must be numbers`);
    if (w.floor !== null && !Number.isFinite(w.floor)) errors.push(`line ${line} (${w.node_id}): floor must be a number`);
    if (w.anchor_map_bearing_deg !== null && !(w.anchor_map_bearing_deg >= 0 && w.anchor_map_bearing_deg < 360)) {
      errors.push(`line ${line} (${w.node_id}): anchor_map_bearing_deg must be in [0, 360)`);
    }
    if (w.type === 'anchor' && w.anchor_map_bearing_deg === null) errors.push(`line ${line} (${w.node_id}): anchor has no anchor_map_bearing_deg`);
    return w;
  });

  const ids = new Set<string>();
  for (const w of waypoints) {
    if (ids.has(w.node_id)) errors.push(`duplicate node_id "${w.node_id}"`);
    ids.add(w.node_id);
  }
  for (const w of waypoints) {
    for (const n of w.neighbors) if (!ids.has(n)) errors.push(`${w.node_id}: neighbour "${n}" does not exist`);
  }
  return { config, waypoints, errors };
}

/** Firestore doc ID for a waypoint: unique across sites, and what QR anchors encode. */
export const waypointDocId = (siteId: string, nodeId: string) => `${siteId}__${nodeId}`;
