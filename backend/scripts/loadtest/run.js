const http = require("http");
const fs = require("fs");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const BASE = arg("base", "http://localhost:5001");
const SCENARIO = arg("scenario", "browse");
const VUS = parseInt(arg("vus", "50"), 10);
const DURATION = parseInt(arg("duration", "30"), 10);
const THINK = String(arg("think", "0")).split("-").map(Number);
const LABEL = arg("label", `${SCENARIO}-${VUS}vus-${DURATION}s`);
const PID = parseInt(arg("pid", "0"), 10);
const POOL = parseInt(arg("pool", "1"), 10);
const OUTDIR = "/tmp/opencode/loadresults";
const ORIGIN = "http://localhost:3000";

const TERMS = ["Piantini", "Bella Vista", "Bávaro", "Naco", "Gazcue", "Los Jardines", "Casa de Campo", "Playa Bonita", "Costambar", "Santo Domingo", "Santiago", "Punta Cana"];
const CITIES = ["Santo Domingo", "Santiago", "Punta Cana", "La Romana", "Las Terrenas", "Jarabacoa", "Puerto Plata"];
const TYPES = ["APARTAMENTO", "CASA", "VILLA"];

const agent = new http.Agent({ keepAlive: true, maxSockets: VUS * 2 + 50, maxFreeSockets: 100 });

let propertyIds = [];
let cookies = [];

const vuIp = (vu) => `10.${Math.floor(vu / 65025) % 255}.${Math.floor(vu / 255) % 255}.${(vu % 255) + 1}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function request(method, urlPath, { headers = {}, body = null, timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      `${BASE}${urlPath}`,
      {
        method,
        agent,
        headers: {
          Origin: ORIGIN,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        let bytes = 0;
        res.on("data", (c) => {
          chunks.push(c);
          bytes += c.length;
          if (bytes > 512 * 1024) res.destroy();
        });
        res.on("end", () => {
          const ms = Number(process.hrtime.bigint() - started) / 1e6;
          resolve({ status: res.statusCode, setCookie: res.headers["set-cookie"], bytes, ms, body: Buffer.concat(chunks).toString() });
        });
      }
    );
    req.setTimeout(timeout, () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (e) => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      resolve({ status: 0, error: e.code || e.message, ms });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function pickBrowse(vu) {
  const h = { "X-Forwarded-For": vuIp(vu) };
  const r = Math.random();
  if (!propertyIds.length || r < 0.55) {
    return { method: "GET", path: `/api/properties?page=${randInt(1, 300)}&limit=12`, headers: h, tag: "list" };
  }
  if (r < 0.7) {
    return { method: "GET", path: `/api/properties/${rand(propertyIds)}`, headers: h, tag: "detail" };
  }
  if (r < 0.85) {
    return { method: "GET", path: `/api/properties?search=${encodeURIComponent(rand(TERMS))}&page=1&limit=12`, headers: h, tag: "search" };
  }
  if (r < 0.95) {
    const city = rand(CITIES);
    const type = rand(TYPES);
    return { method: "GET", path: `/api/properties?city=${encodeURIComponent(city)}&type=${type}&minPrice=50000&maxPrice=5000000&page=${randInt(1, 20)}&limit=12`, headers: h, tag: "filters" };
  }
  return { method: "GET", path: `/api/rates`, headers: h, tag: "rates" };
}

function pickAuthed(vu) {
  const h = { "X-Forwarded-For": vuIp(vu), Cookie: cookies[vu] || "" };
  const r = Math.random();
  if (r < 0.35) return { method: "GET", path: `/api/properties?page=${randInt(1, 200)}&limit=12`, headers: h, tag: "list" };
  if (r < 0.5) return { method: "GET", path: `/api/properties/${rand(propertyIds)}`, headers: h, tag: "detail" };
  if (r < 0.6) return { method: "GET", path: `/api/properties?search=${encodeURIComponent(rand(TERMS))}`, headers: h, tag: "search" };
  if (r < 0.72) return { method: "GET", path: `/api/favorites`, headers: h, tag: "favorites" };
  if (r < 0.82) return { method: "GET", path: `/api/messages?propertyId=${rand(propertyIds)}`, headers: h, tag: "messages" };
  if (r < 0.9) return { method: "GET", path: `/api/notifications`, headers: h, tag: "notifications" };
  if (r < 0.96) return { method: "GET", path: `/api/auth/me`, headers: h, tag: "me" };
  return { method: "GET", path: `/api/saved-searches`, headers: h, tag: "saved-searches" };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function sampleProc(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
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

  const boot = await request("GET", "/api/health");
  if (boot.status !== 200 && boot.status !== 500) {
    console.error(`Servidor no disponible en ${BASE}: ${boot.status}`);
    process.exit(1);
  }

  const listRes = await request("GET", "/api/properties?page=1&limit=50");
  try {
    propertyIds = JSON.parse(listRes.body).properties.map((p) => p.id);
  } catch {}
  if (!propertyIds.length) {
    console.error("No se pudieron cargar ids de propiedades");
    process.exit(1);
  }
  console.log(`Setup OK: ${propertyIds.length} ids | escenario=${SCENARIO} vus=${VUS} duración=${DURATION}s think=${THINK.join("-")}ms base=${BASE}`);

  if (SCENARIO === "authed") {
    console.log("Logueando usuarios virtuales...");
    const batch = 50;
    for (let start = 0; start < VUS; start += batch) {
      await Promise.all(
        Array.from({ length: Math.min(batch, VUS - start) }, async (_, k) => {
          const vu = start + k;
          const res = await request("POST", "/api/auth/login", {
            headers: { "X-Forwarded-For": vuIp(vu) },
            body: POOL > 1
              ? { email: `lt-user-${vu % POOL}@loadtest.local`, password: "123456" }
              : { email: "loadtest@domify.com", password: "123456" },
            timeout: 30000,
          });
          const raw = res.setCookie?.[0];
          cookies[vu] = raw ? raw.split(";")[0] : "";
        })
      );
      process.stdout.write(`\r  ${Math.min(start + batch, VUS)}/${VUS}`);
    }
    const ok = cookies.filter(Boolean).length;
    console.log(`\nLogin: ${ok}/${VUS} OK`);
    if (ok < VUS * 0.9) {
      console.error("Demasiados logins fallidos, abortando");
      process.exit(1);
    }
  }

  const pick = SCENARIO === "browse" ? pickBrowse : pickAuthed;
  const results = [];
  const errors = {};
  const tags = {};
  let startedCount = 0;

  let prev = PID ? await sampleProc(PID) : null;
  let cpuSamples = [];
  let cpuTimer = null;
  if (PID) {
    cpuTimer = setInterval(async () => {
      const cur = await sampleProc(PID);
      if (cur && prev) {
        const dt = (cur.t - prev.t) / 1000;
        const cpu = ((cur.ticks - prev.ticks) / 100 / dt) * 100;
        cpuSamples.push({ cpu, rss: cur.rss / 1024 });
      }
      if (cur) prev = cur;
    }, 1000);
  }

  const deadline = Date.now() + DURATION * 1000;
  const startedAt = Date.now();

  async function runVU(vu) {
    while (Date.now() < deadline) {
      const spec = pick(vu);
      const res = await request(spec.method, spec.path, { headers: spec.headers });
      results.push(res.ms);
      tags[spec.tag] = (tags[spec.tag] || 0) + 1;
      const key = res.status === 0 ? `net:${res.error}` : res.status >= 400 ? `http:${res.status}` : "ok";
      errors[key] = (errors[key] || 0) + 1;
      if (res.ms > 15000) break;
      if (THINK.length > 1 && THINK[1] > 0) await sleep(randInt(THINK[0], THINK[1]));
      else if (THINK[0] > 0) await sleep(THINK[0]);
    }
  }

  const rampStart = setInterval(() => {
    const launched = Math.min(VUS, startedCount + Math.max(1, Math.ceil(VUS / 10)));
    while (startedCount < launched) {
      runVU(startedCount);
      startedCount++;
    }
  }, DURATION * 100);

  setTimeout(() => clearInterval(rampStart), DURATION * 1000 + 100);
  await sleep(DURATION * 1000 + 15000);

  const wall = (Date.now() - startedAt) / 1000;
  if (cpuTimer) clearInterval(cpuTimer);

  const sorted = results.slice().sort((a, b) => a - b);
  const total = sorted.length;
  const errTotal = Object.entries(errors).filter(([k]) => k !== "ok").reduce((s, [, v]) => s + v, 0);
  const rps = total / wall;
  const cpu = cpuSamples.length ? cpuSamples.reduce((s, c) => s + c.cpu, 0) / cpuSamples.length : null;
  const cpuMax = cpuSamples.length ? Math.max(...cpuSamples.map((c) => c.cpu)) : null;
  const rssMax = cpuSamples.length ? Math.max(...cpuSamples.map((c) => c.rss)) : null;

  const summary = {
    label: LABEL,
    scenario: SCENARIO,
    vus: VUS,
    duration_s: DURATION,
    think_ms: THINK,
    base: BASE,
    total_requests: total,
    rps: Number(rps.toFixed(1)),
    errors_total: errTotal,
    error_pct: Number(((errTotal / total) * 100).toFixed(2)),
    latency_ms: {
      p50: Number(percentile(sorted, 50).toFixed(1)),
      p90: Number(percentile(sorted, 90).toFixed(1)),
      p95: Number(percentile(sorted, 95).toFixed(1)),
      p99: Number(percentile(sorted, 99).toFixed(1)),
      max: Number((sorted[sorted.length - 1] || 0).toFixed(1)),
      mean: Number((sorted.reduce((s, v) => s + v, 0) / total).toFixed(1)),
    },
    by_status: errors,
    by_tag: tags,
    server_cpu_pct_avg: cpu !== null ? Number(cpu.toFixed(1)) : null,
    server_cpu_pct_max: cpuMax !== null ? Number(cpuMax.toFixed(1)) : null,
    server_rss_mb_max: rssMax !== null ? Number(rssMax.toFixed(0)) : null,
  };

  fs.writeFileSync(`${OUTDIR}/${LABEL}.json`, JSON.stringify(summary, null, 2));
  console.log("\n=== RESULTADO ===");
  console.log(JSON.stringify(summary, null, 2));
  agent.destroy();
  process.exit(0);
}

main();
