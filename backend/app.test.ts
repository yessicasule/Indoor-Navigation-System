// HTTP-level tests of the API against an in-memory fake Firestore loaded with the template site.
// Run with `npm test`.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createApp } from './app';
import { FakeDb, seedSite } from './fake-db';

const SITE = '_template';

function seededDb(): FakeDb {
  const db = new FakeDb();
  seedSite(db, SITE, { north_offset_deg: 6.5 });
  // A second site sharing node IDs, to check queries stay within one site.
  db.col('ar_waypoints').set('other__A1', { station_id: 'other', node_id: 'A1', name: 'Other Entrance', x: 0, y: 0, neighbors: [] });
  return db;
}

async function serve(app: ReturnType<typeof createApp>) {
  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, base };
}

describe('indoor navigation API', () => {
  const db = seededDb();
  let server: Server;
  let base: string;
  before(async () => ({ server, base } = await serve(createApp({ db, storageAvailable: true, serverTimestamp: () => 'ts' }))));
  after(() => server.close());

  it('lists named destinations of one site only', async () => {
    const res = await fetch(`${base}/api/destinations?stationId=${SITE}`);
    assert.equal(res.status, 200);
    const names = (await res.json()).map((d: any) => d.name).sort();
    assert.deepEqual(names, ['First Floor Landing', 'Lab 101', 'Main Entrance', 'Room 201']);
  });

  it('requires stationId', async () => {
    assert.equal((await fetch(`${base}/api/destinations`)).status, 400);
  });

  it('returns an anchor waypoint with its surveyed facing bearing', async () => {
    const res = await fetch(`${base}/api/waypoints/${SITE}__A1`);
    assert.equal(res.status, 200);
    const w = await res.json();
    assert.equal(w.station_id, SITE);
    assert.equal(w.type, 'anchor');
    assert.equal(w.anchor_map_bearing_deg, 0);
    assert.equal((await fetch(`${base}/api/waypoints/nope`)).status, 404);
  });

  it('finds the shortest multi-floor path', async () => {
    const res = await fetch(`${base}/api/ar-path?from=${SITE}__A1&to=${SITE}__R201`);
    const body = await res.json();
    assert.equal(body.found, true);
    assert.deepEqual(body.path.map((n: any) => n.node_id), ['A1', 'C1', 'C2', 'STG', 'ST1', 'R201']);
    assert.equal(body.path[4].floor, 1);
  });

  it('refuses a destination in another site', async () => {
    assert.equal((await fetch(`${base}/api/ar-path?from=${SITE}__A1&to=other__A1`)).status, 404);
    assert.equal((await fetch(`${base}/api/ar-path?from=missing&to=${SITE}__A1`)).status, 404);
    assert.equal((await fetch(`${base}/api/ar-path?from=${SITE}__A1`)).status, 400);
  });

  it('returns site settings', async () => {
    const res = await fetch(`${base}/api/sites/${SITE}`);
    assert.deepEqual(await res.json(), { site_id: SITE, name: 'Template Building (example data, not a real survey)', north_offset_deg: 6.5 });
    assert.equal((await fetch(`${base}/api/sites/none`)).status, 404);
  });

  it('caches a site graph between route requests', async () => {
    const counting = seededDb();
    let reads = 0;
    const realCollection = counting.collection.bind(counting);
    counting.collection = (name: string) => {
      const c = realCollection(name);
      return { ...c, where: (...a: [string, string, unknown]) => { reads++; return c.where(...a); } };
    };
    const { server: s2, base: b2 } = await serve(createApp({ db: counting, storageAvailable: false }));
    try {
      for (let i = 0; i < 3; i++) await fetch(`${b2}/api/ar-path?from=${SITE}__A1&to=${SITE}__R201`);
      assert.equal(reads, 1);
    } finally {
      s2.close();
    }
  });

  it('answers unknown API routes with JSON 404', async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  });
});

describe('telemetry ingestion', () => {
  const db = new FakeDb();
  let server: Server;
  let base: string;
  before(async () => ({ server, base } = await serve(createApp({ db, storageAvailable: true, serverTimestamp: () => 'ts' }))));
  after(() => server.close());

  const t0 = 1_760_000_000_000;
  const post = (body: unknown, type = 'application/json') =>
    fetch(`${base}/api/telemetry`, { method: 'POST', headers: { 'Content-Type': type }, body: JSON.stringify(body) });

  it('stores a valid batch, nulling bad fields and dropping samples without a timestamp', async () => {
    const res = await post({
      batch_id: 'batch-0001',
      session: { session_id: 's1', device_model: 'Pixel 7', site_id: SITE, injected: 'x' },
      samples: [
        { timestamp_ms: t0, raw_heading: 12.5, event_type: 'deviceorientationabsolute', absolute_flag: true, extra: 1 },
        { timestamp_ms: t0 + 200, raw_heading: 400, event_type: 'bogus', absolute_flag: 'yes' }, // 3 bad fields
        { raw_heading: 10 }, // no timestamp: dropped
      ],
    });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { stored: 2, dropped: 1, nulled_fields: 3 });

    const doc = db.col('telemetry_batches').get('batch-0001')!;
    assert.equal(doc.session_id, 's1');
    assert.equal(doc.injected, undefined, 'unknown session fields are not stored');
    assert.equal(doc.samples[0].raw_heading, 12.5);
    assert.equal(doc.samples[0].extra, undefined, 'unknown sample fields are not stored');
    assert.equal(doc.samples[1].raw_heading, null);
    assert.equal(doc.samples[1].event_type, null);
    assert.equal(doc.samples[1].absolute_flag, null);
    assert.deepEqual(doc.validation, { dropped_samples: 1, nulled_fields: 3 });
  });

  it('is idempotent per batch_id (retries and beacons overwrite)', async () => {
    const body = { batch_id: 'batch-0002', session: { session_id: 's1' }, samples: [{ timestamp_ms: t0 }] };
    await post(body);
    await post(body, 'text/plain'); // sendBeacon path
    assert.equal([...db.col('telemetry_batches').keys()].filter(k => k === 'batch-0002').length, 1);
  });

  it('rejects malformed batches', async () => {
    assert.equal((await post({ session: { session_id: 's' }, samples: [{ timestamp_ms: t0 }] })).status, 400);
    assert.equal((await post({ batch_id: 'bad id!', session: { session_id: 's' }, samples: [{ timestamp_ms: t0 }] })).status, 400);
    assert.equal((await post({ batch_id: 'batch-0003', session: { session_id: 's' }, samples: [] })).status, 400);
    assert.equal((await post({ batch_id: 'batch-0004', session: { session_id: 's' }, samples: [{ raw_heading: 1 }] })).status, 400);
    const res = await fetch(`${base}/api/telemetry`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{oops' });
    assert.equal(res.status, 400);
  });
});

describe('without Firebase', () => {
  it('returns 503 for telemetry so the client keeps its queue', async () => {
    const { server, base } = await serve(createApp({ db: new FakeDb(), storageAvailable: false }));
    try {
      const res = await fetch(`${base}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: 'batch-0005', session: { session_id: 's' }, samples: [{ timestamp_ms: 1_760_000_000_000 }] }),
      });
      assert.equal(res.status, 503);
    } finally {
      server.close();
    }
  });
});

describe('frontend serving', () => {
  it('serves index.html for client-side routes but not for /api', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title>');
    const { server, base } = await serve(createApp({ db: new FakeDb(), storageAvailable: false, frontendDist: dist }));
    try {
      const page = await fetch(`${base}/ar?site=x&node=y`);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /<title>app<\/title>/);
      assert.equal((await fetch(`${base}/api/nope`)).status, 404);
    } finally {
      server.close();
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});
