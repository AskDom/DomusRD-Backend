const http = require("http");
const fs = require("fs");
const { io } = require("/data/Ask95/Real-Estate/node_modules/socket.io-client");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const BASE = arg("base", "http://localhost:5001");
const VUS = parseInt(arg("vus", "200"), 10);
const DURATION = parseInt(arg("duration", "60"), 10);
const LABEL = arg("label", `ws-${VUS}sockets-${DURATION}s`);
const PID = parseInt(arg("pid", "0"), 10);
const OUTDIR = "/tmp/opencode/loadresults";

const vuIp = (vu) => `10.${Math.floor(vu / 65025) % 255}.${Math.floor(vu / 255) % 255}.${(vu % 255) + 1}`;

function login(vu) {
  return new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ email: `lt-user-${vu % 600}@loadtest.local`, password: "123456" }));
    const req = http.request(
      `${BASE}/api/auth/login`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": payload.length, "X-Forwarded-For": vuIp(vu), Origin: "http://localhost:3000" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, token: res.headers["set-cookie"]?.[0]?.split(";")[0]?.split("=")[1], body }));
      }
    );
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.write(payload);
    req.end();
  });
}

async function sampleProc(pid) {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const parts = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const ticks = Number(parts[11]) + Number(parts[12]);
    const rss = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] || 0);
    return { t: Date.now(), ticks, rss };
  } catch {
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUTDIR, { recursive: true });
  console.log(`WS test: ${VUS} sockets, ${DURATION}s`);

  console.log("Logueando...");
  const tokens = new Array(VUS).fill(null);
  const batch = 50;
  for (let start = 0; start < VUS; start += batch) {
    await Promise.all(
      Array.from({ length: Math.min(batch, VUS - start) }, async (_, k) => {
        const res = await login(start + k);
        if (res.status === 200 && res.token) tokens[start + k] = res.token;
      })
    );
    process.stdout.write(`\r  ${Math.min(start + batch, VUS)}/${VUS}`);
  }
  const tokensOk = tokens.filter(Boolean).length;
  console.log(`\nTokens OK: ${tokensOk}/${VUS}`);

  let connected = 0;
  let failed = 0;
  let disconnectedMid = 0;
  const hsTimes = [];

  let prev = PID ? await sampleProc(PID) : null;
  const samples = [];
  const sampler = setInterval(async () => {
    const cur = PID ? await sampleProc(PID) : null;
    if (cur && prev) {
      const dt = (cur.t - prev.t) / 1000;
      samples.push({ cpu: ((cur.ticks - prev.ticks) / 100 / dt) * 100, rss: cur.rss / 1024, connected });
    }
    if (cur) prev = cur;
  }, 1000);

  const deadline = Date.now() + DURATION * 1000;
  const startedAt = Date.now();

  await new Promise((resolveAll) => {
    let idx = 0;
    const launchNext = setInterval(() => {
      const stopNow = Date.now() > deadline;
      if (idx >= VUS && (!tokens.includes(null) || stopNow)) {
        clearInterval(launchNext);
        setTimeout(resolveAll, Math.max(0, deadline - Date.now()) + 5000);
        return;
      }
      if (stopNow || idx >= VUS) return;
      const vu = idx++;
      const token = tokens[vu];
      if (!token) {
        failed++;
        return;
      }
      const t0 = Date.now();
      const socket = io(BASE, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
        timeout: 20000,
      });
      socket.on("connect", () => {
        connected++;
        hsTimes.push(Date.now() - t0);
      });
      socket.on("connect_error", () => {
        failed++;
        socket.close();
      });
      socket.on("disconnect", () => {
        disconnectedMid++;
      });
    }, Math.max(5, Math.floor(10000 / VUS)));
  });

  clearInterval(sampler);
  const wall = (Date.now() - startedAt) / 1000;
  const sortedHs = hsTimes.slice().sort((a, b) => a - b);
  const pct = (p) => sortedHs[Math.min(sortedHs.length - 1, Math.ceil((p / 100) * sortedHs.length) - 1)] || 0;

  const summary = {
    label: LABEL,
    type: "websocket",
    target_sockets: VUS,
    duration_s: DURATION,
    tokens_ok: tokensOk,
    connected_final: connected,
    connect_failed: failed,
    disconnects_observed: disconnectedMid,
    handshake_ms: {
      p50: pct(50),
      p90: pct(90),
      p99: pct(99),
      max: sortedHs[sortedHs.length - 1] || 0,
    },
    wall_s: Number(wall.toFixed(1)),
    server_rss_mb_max: samples.length ? Number(Math.max(...samples.map((s) => s.rss)).toFixed(0)) : null,
    server_cpu_pct_max: samples.length ? Number(Math.max(...samples.map((s) => s.cpu)).toFixed(1)) : null,
    rss_series: samples.map((s) => ({ t_sec: Number(((s.t - startedAt) / 1000).toFixed(1)), rss_mb: Number(s.rss.toFixed(0)), connected: s.connected })),
  };

  fs.writeFileSync(`${OUTDIR}/${LABEL}.json`, JSON.stringify(summary, null, 2));
  console.log("\n=== RESULTADO WS ===");
  console.log(JSON.stringify({ ...summary, rss_series: undefined }, null, 2));
  process.exit(0);
}

main();
