// Tiny persistent store (JSON file). Works on Vercel for demo; for production
// swap to Vercel KV / Upstash Redis / Firebase (see README).
import fs from "fs";
import path from "path";

const FILE = path.join("/tmp", "ldg-store.json");
// fallback to project dir when /tmp not writable
function filePath() {
  try {
    fs.accessSync("/tmp", fs.constants.W_OK);
    return FILE;
  } catch {
    return path.join(process.cwd(), ".ldg-store.json");
  }
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function purgeExpired(data) {
  if (!data) return data;
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const isFresh = (ts) => {
    if (!ts) return true;
    const t = new Date(ts).getTime();
    return isNaN(t) || t >= cutoff;
  };

  if (Array.isArray(data.locations)) {
    data.locations = data.locations.filter((l) => isFresh(l.ts));
  }
  if (Array.isArray(data.audioRecordings)) {
    data.audioRecordings = data.audioRecordings.filter((a) => isFresh(a.ts));
  }
  if (Array.isArray(data.photos)) {
    data.photos = data.photos.filter((p) => isFresh(p.ts));
  }
  if (Array.isArray(data.alerts)) {
    data.alerts = data.alerts.filter((a) => isFresh(a.ts));
  }
  if (Array.isArray(data.commands)) {
    data.commands = data.commands.filter((c) => isFresh(c.createdAt || c.ts));
  }
  if (Array.isArray(data.log)) {
    data.log = data.log.filter((l) => isFresh(l.t || l.ts));
  }
  return data;
}

function load() {
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return purgeExpired(parsed);
  } catch {
    return { devices: [], commands: [], log: [], locations: [], audioRecordings: [], photos: [], alerts: [] };
  }
}

function save(data) {
  try {
    purgeExpired(data);
    fs.writeFileSync(filePath(), JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("store save failed", e);
  }
}

export function getStore() {
  return load();
}

export function updateStore(fn) {
  const data = load();
  const out = fn(data) || data;
  save(out);
  return out;
}

export function addLog(entry) {
  updateStore((d) => {
    d.log = d.log || [];
    d.log.unshift({ t: new Date().toISOString(), ...entry });
    d.log = d.log.slice(0, 300);
    return d;
  });
}
