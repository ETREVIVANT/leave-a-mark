import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import crypto from "crypto";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { WebSocketServer } from "ws";

// --- config ---
const PORT = process.env.PORT || 8787;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://etrevivant.github.io"; // GH Pages origin (no trailing slash)
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), "marks.sqlite");
const IP_SALT = process.env.IP_SALT || "leave_a_mark_v1";
const MARKS_CAP = Number(process.env.MARKS_CAP || 5000);

// --- db ---
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "");
const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
await db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER);
  INSERT OR IGNORE INTO stats (k, v) VALUES ('visitors', 0), ('marks', 0);

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    gx INTEGER NOT NULL,
    gy INTEGER NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_marks_at ON marks(at DESC);

  CREATE TABLE IF NOT EXISTS ips (
    iphash TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );
`);
const getStat = async (k) => (await db.get("SELECT v FROM stats WHERE k=?", k))?.v ?? 0;
const setStat = (k, v) => db.run("INSERT INTO stats(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, v);
const incrStat = async (k, n=1) => setStat(k, (await getStat(k)) + n);
const ipHash = (ip) => crypto.createHash("sha256").update(ip + IP_SALT).digest("hex");

// --- app + server ---
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(morgan("tiny"));
app.use(express.json({ limit: "2mb" }));

// --- http server + websocket ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set();
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});
function broadcast(json) {
  const msg = JSON.stringify(json);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// --- routes ---
app.post("/api/visit", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "0.0.0.0").toString().split(",")[0].trim();
    const hash = ipHash(ip);
    const now = Date.now();
    const row = await db.get("SELECT last_seen FROM ips WHERE iphash=?", hash);
    const THIRTY = 30 * 24 * 60 * 60 * 1000;
    if (!row) {
      await db.run("INSERT INTO ips(iphash,first_seen,last_seen) VALUES(?,?,?)", hash, now, now);
      await incrStat("visitors", 1);
    } else {
      await db.run("UPDATE ips SET last_seen=? WHERE iphash=?", now, hash);
      if (now - Number(row.last_seen) > THIRTY) await incrStat("visitors", 1);
    }
    res.json({ ok: true, visitors: await getStat("visitors"), marks: await getStat("marks") });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "visit_failed" });
  }
});

app.get("/api/marks", async (_req, res) => {
  try {
    const rows = await db.all("SELECT data,gx,gy,at FROM marks ORDER BY at DESC LIMIT 1000");
    res.json({ ok: true, marks: rows, count: rows.length });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "marks_get_failed" });
  }
});

app.post("/api/marks", async (req, res) => {
  try {
    const { data, gx, gy } = req.body || {};
    if (!data || typeof gx !== "number" || typeof gy !== "number") return res.status(400).json({ error: "bad_body" });
    const at = Date.now();
    await db.run("INSERT INTO marks(data,gx,gy,at) VALUES(?,?,?,?)", data, gx, gy, at);
    await incrStat("marks", 1);

    // cap size
    const cnt = (await db.get("SELECT COUNT(*) AS c FROM marks")).c;
    const excess = cnt - MARKS_CAP;
    if (excess > 0) await db.run("DELETE FROM marks WHERE id IN (SELECT id FROM marks ORDER BY at ASC LIMIT ?)", excess);

    const payload = { type: "mark", mark: { data, gx, gy, at } };
    broadcast(payload); // real-time to everyone

    res.json({ ok: true, saved: true, visitors: await getStat("visitors"), marks: await getStat("marks") });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "marks_post_failed" });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    res.json({ ok: true, visitors: await getStat("visitors"), marks: await getStat("marks") });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "stats_failed" });
  }
});

app.post("/api/reset", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
    await db.run("DELETE FROM marks");
    await setStat("marks", 0);
    broadcast({ type: "reset" });
    res.json({ ok: true, reset: true });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "reset_failed" });
  }
});

server.listen(PORT, () => {
  console.log(`API on :${PORT}  (CORS allowed: ${ALLOWED_ORIGIN})`);
});
