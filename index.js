import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { Server as IOServer } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

/* -------- CONFIG (set via env or edit here) -------- */
const PORT = process.env.PORT || 8787;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://etrevivant.github.io"; // GH Pages origin (no trailing slash)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me";
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), "marks.sqlite");
const MARKS_CAP = Number(process.env.MARKS_CAP || 5000);
const IP_SALT = process.env.IP_SALT || "leave_a_mark_v1";

/* -------- DB -------- */
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "");
const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
await db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER);
  INSERT OR IGNORE INTO stats (k, v) VALUES ('visitors', 0), ('marks', 0);

  CREATE TABLE IF NOT EXISTS ips (
    iphash TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    gx INTEGER NOT NULL,
    gy INTEGER NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_marks_at ON marks(at DESC);
`);

const getStat = async (k) => Number((await db.get("SELECT v FROM stats WHERE k=?", k))?.v ?? 0);
const setStat = (k, v) => db.run("INSERT INTO stats(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", k, v);
const incrStat = async (k, n = 1) => setStat(k, (await getStat(k)) + n);
const ipHash = (ip) => crypto.createHash("sha256").update(ip + IP_SALT).digest("hex");

/* -------- HTTP + Socket.IO -------- */
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(morgan("tiny"));
app.use(express.json({ limit: "2mb" })); // PNG dataurls

app.get("/api/stats", async (_req, res) => {
  res.json({ ok: true, visitors: await getStat("visitors"), marks: await getStat("marks") });
});

app.post("/api/reset", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  await db.run("DELETE FROM marks");
  await setStat("marks", 0);
  io.emit("world:reset");
  res.json({ ok: true, reset: true });
});

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] }
});

/* -------- Helpers -------- */
function clientIP(socket) {
  const xff = socket.handshake.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  const a = socket.request?.socket?.remoteAddress || "";
  return a.includes("::ffff:") ? a.split("::ffff:")[1] : a;
}

/* -------- Socket events --------
  Client flow:
  - connect -> server counts visit (unique by IP hash / 30 days)
  - server emits 'state:init' with { visitors, marks, recentMarks }
  - client emits 'mark:save' {data,gx,gy} -> server persists + io.emit('mark:new', mark)
------------------------------------------------------ */
io.on("connection", async (socket) => {
  try {
    // Unique visitor check (30-day window)
    const ip = clientIP(socket) || "0.0.0.0";
    const hash = ipHash(ip);
    const now = Date.now();
    const row = await db.get("SELECT last_seen FROM ips WHERE iphash=?", hash);
    const THIRTY = 30 * 24 * 60 * 60 * 1000;
    if (!row) {
      await db.run("INSERT INTO ips(iphash, first_seen, last_seen) VALUES(?,?,?)", hash, now, now);
      await incrStat("visitors", 1);
    } else {
      await db.run("UPDATE ips SET last_seen=? WHERE iphash=?", now, hash);
      if (now - Number(row.last_seen) > THIRTY) await incrStat("visitors", 1);
    }

    // Send initial state
    const visitors = await getStat("visitors");
    const marksCount = await getStat("marks");
    const recent = await db.all("SELECT data,gx,gy,at FROM marks ORDER BY at DESC LIMIT 1000");
    socket.emit("state:init", { visitors, marks: marksCount, recentMarks: recent });

    // Save mark
    socket.on("mark:save", async (payload) => {
      try {
        const { data, gx, gy } = payload || {};
        if (!data || typeof gx !== "number" || typeof gy !== "number") return;
        const at = Date.now();
        await db.run("INSERT INTO marks (data,gx,gy,at) VALUES (?,?,?,?)", data, gx, gy, at);
        await incrStat("marks", 1);

        // cap size
        const cnt = (await db.get("SELECT COUNT(*) AS c FROM marks")).c;
        const excess = cnt - MARKS_CAP;
        if (excess > 0) {
          await db.run("DELETE FROM marks WHERE id IN (SELECT id FROM marks ORDER BY at ASC LIMIT ?)", excess);
        }

        const stats = { visitors: await getStat("visitors"), marks: await getStat("marks") };
        const mark = { data, gx, gy, at };

        // Broadcast to everyone
        io.emit("mark:new", { mark, stats });
      } catch (e) {
        console.error("save error", e);
      }
    });

    // Admin reset via socket (optional)
    socket.on("admin:reset", async (token) => {
      if (token !== ADMIN_TOKEN) return;
      await db.run("DELETE FROM marks");
      await setStat("marks", 0);
      io.emit("world:reset");
    });

  } catch (e) {
    console.error("socket error", e);
  }
});

server.listen(PORT, () => {
  console.log(`Realtime API on :${PORT}  (CORS/WS origin: ${ALLOWED_ORIGIN})`);
});
