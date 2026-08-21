# Informe de Pruebas de Carga — Domify Backend

**Fecha:** 21 de agosto de 2026
**Alcance:** `Backend-Real-Estate/backend` (Express + Prisma + PostgreSQL + Socket.IO)
**Pregunta objetivo:** ¿Cuántos usuarios simultáneos en directo aguanta la API?

---

## 1. Resumen ejecutivo

| Métrica | Resultado |
|---|---|
| Usuarios web simultáneos **sanos** (p95 < 600 ms, sin errores) | **~3.000** |
| Zona de degradación (latencias > 1 s) | ~4.000 – 5.000 |
| **Colapso** (p95 > 9 s, timeouts) | **~6.000** |
| Techo absoluto HTTP | **~550 req/s** |
| WebSockets simultáneos verificados | **5.000 al 100%** (CPU 54%) |
| Cuello de botella | **CPU de PostgreSQL**, no Node |

**Respuesta directa:** en el hardware de prueba, la API sostiene **~3.000 usuarios activos navegando a la vez con excelente experiencia**, empieza a degradarse pasados ~4.500 y colapsa cerca de 6.000. El chat en directo (WebSockets) no es limitante: 5.000 conexiones simultáneas consumen solo 54% de CPU y ~60 MB extra de RAM.

El límite lo pone **PostgreSQL (~550 rps)**: Node apenas llega al 25% de su capacidad bajo carga realista. Esto significa que las mejoras más rentables son *reducir consultas por request* (caché + paginación keyset), no escalar Node.

> ⚠️ Nota metodológica: las pruebas corrieron en una máquina compartida (12 vCPU, 14 GB RAM) junto al servidor de desarrollo del usuario y otros procesos. Los números absolutos tienen ±10–20% de margen; los cuellos de botella identificados y el orden relativo de los resultados sí son concluyentes.

---

## 2. Metodología

- **Datos:** base dedicada `domify_loadtest` con 50.000 propiedades y 600 usuarios reales sembrados.
- **Arnés propio** (`backend/scripts/loadtest/run.js` y `ws.js`, Node puro, sin dependencias nuevas):
  - IP distinta por usuario virtual vía `X-Forwarded-For` (el backend usa `trust proxy 1`) → cada VU respeta su propio rate-limit de 100 req/min como un cliente real.
  - Cabecera `Origin` válida en todos los requests (requerida por CORS en producción).
  - Escenario `browse`: 55% listados paginados, 15% detalle, 15% búsqueda ILIKE, 10% filtros combinados, 5% tasas.
  - Modo realista con *think-time* 2–8 s entre acciones (≈12–30 req/min por usuario, ritmo de navegación humana).
- **Dos instancias bajo prueba:**
  - `:5001` — `NODE_ENV=production` con rate-limiters activos (config idéntica a producción).
  - `:5002` — rate-limiters desactivados para medir el techo físico del hardware.
- **Muestreo:** CPU/RSS del proceso Node vía `/proc`, conexiones activas de BD vía `pg_stat_activity`, CPU del contenedor Postgres vía `docker stats`.
- Resultados crudos: `backend/scripts/loadtest/results/*.json`.

---

## 3. Resultados

### 3.1 Techo físico (sin rate-limit, usuarios agresivos sin pausas)

| VUs | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Errores | CPU Node |
|---|---|---|---|---|---|---|
| 100 | 512 | 58 | 114 | 130 | 0% | 141% |
| 250 | 488 | 153 | 310 | 409 | 0% | 145% |
| 500 | 538 | 266 | 459 | 1.134 | 0% | 166% |
| 1.000 | 556 | 314 | 424 | **14.225** | 0,95% (timeouts) | 169% |

Lectura: a partir de ~250 VUs el throughput **no crece** aunque se suman usuarios; solo sube la cola de espera. Postgres se mantuvo en **~505–650% CPU** durante estas corridas con solo 8–10 queries en vuelo → el techo es capacidad de ejecución de la BD.

Endpoint trivial sin BD (`/api/rates`) a 500 VUs: **4.820 rps** → descarta que el generador o Express sean el cuello.

Latencia secuencial por endpoint (30 muestras): listado 7,6 ms · listado página 900 12,7 ms · búsqueda 13,1 ms · filtros 15,6 ms · detalle 3,3 ms → las queries individuales son rápidas; el problema es pura concurrencia contra la BD.

### 3.2 Usuarios reales simultáneos (producción, think-time 2–8 s)

| Usuarios | RPS | p50 | p95 | p99 | Errores | CPU Node | Veredicto |
|---|---|---|---|---|---|---|---|
| 1.000 | 78 | 5,9 ms | 138 ms | 179 ms | 0,09% | 23% | ✅ Sobrado |
| 3.000 | 232 | 8,9 ms | 573 ms | 1,07 s | 0,03% | 68% | ✅ Sano |
| 6.000 | 404 | 182 ms | **9,2 s** | **19,4 s** | **1,66%** | 126% | ❌ Colapso |

### 3.3 WebSockets "en directo" (chat)

| Sockets | Conectados | Handshake p50 | CPU máx Node | RSS máx |
|---|---|---|---|---|
| 600 | 600 (100%) | 4 ms | 22% | 177 MB |
| 2.500 | 2.500 (100%) | 2 ms | 39% | 193 MB (~13 KB/socket) |
| 5.000 | 5.000 (100%) | 3 ms | 54% | 223 MB |

Entrega extremo a extremo verificada: `POST /api/messages` → evento `new_message` recibido por el destinatario conectado en **15 ms** totales. ✅

---

## 4. Hallazgos

### 🔴 Críticos

> **✅ LOS 3 CRÍTICOS FUERON REMEDIADOS el 2026-08-21** (ver detalle al final de cada hallazgo). Verificación: 148/148 tests en verde, smoke test en modo producción OK, protección CSRF intacta.

**H1. CORS en producción rompe clientes legítimos sin cabecera Origin**
En `app.js` (líneas 53–56), con `NODE_ENV=production` toda petición sin `Origin` responde **500**. Verificado empíricamente:

```
$ curl http://<host>/api/health        # NODE_ENV=production
→ 500 {"error":"Error interno del servidor"}
```

Impacto:
- La app móvil (**React Native no envía Origin**) no podría ni loguearse.
- Los **health checks de Render** (GET sin Origin) marcarían el servicio como caído.
- Evidencia: 600 errores `CORS: petición sin origin` en el log durante las pruebas.

*Fix:* eliminar ese rechazo. El CSRF ya está mitigado por la cookie `SameSite=Lax` + el header obligatorio `x-domify-client` en métodos inseguros (`auth.middleware.js`). Permitir `origin === undefined` siempre.

**✅ Aplicado:** `app.js` ahora permite peticiones sin `Origin` en todos los entornos. Verificado en modo producción: health/login sin Origin → 200; origen malicioso sigue bloqueado; el header CSRF (`x-domify-client`) sigue siendo obligatorio en POST (403 sin él).

**H2. Drift entre schema.prisma y migraciones — un deploy limpio fallaría**
La columna `users.cedula` existe en dev/test (sincronizadas con `db push`) pero **no existe migración que la cree**. `npm start` ejecuta `prisma migrate deploy`: una base nueva quedaría sin esa columna y **login/registro responderían 500** (error P2022 reproducido en la base de carga). Además, `prisma db push` en la base de carga advirtió pérdida de datos por más diferencias.

*Fix:* generar la migración faltante (`prisma migrate diff --from-migrations --to-schema-datamodel` para detectar todo el drift) y añadir a CI un check de drift antes de mergear.

**✅ Aplicado:** migración idempotente `20260821090000_add_user_cedula` (detectado con `migrate diff`: el drift era solo `cedula` + su índice único). Aplicada a dev, test y loadtest; verificado deploy limpio sobre base nueva (columna presente). CI ampliado con step `prisma migrate diff --exit-code` que falla el PR si vuelve a haber drift. Suite completa: 148/148.

**H3. Secretos reales commiteadas**
`.env` contiene credenciales válidas de Cloudinary (`CLOUDINARY_API_KEY`/`SECRET`) y `.env.test` también lleva secretos. Cualquiera con acceso al repo puede abusar la cuenta de Cloudinary.

*Fix:* rotar las claves ahora, moverlas a variables de entorno del proveedor (Render), y asegurar `.gitignore`.

**✅ Aplicado:** verificado con `git log -S` que las claves **nunca entraron al historial** (los `.env` siempre estuvieron fuera de tracking; `backend/.gitignore` ya cubría `.env` y `.env.test`, se reforzó además el `.gitignore` raíz). Los valores reales fueron reemplazados por placeholders en `backend/.env`. **Pendiente del lado de ustedes (no automatizable):** generar credenciales nuevas en cloudinary.com → Settings → Security y pegarlas en `backend/.env`; la clave vieja quedará inutilizable en cuanto la eliminen del dashboard.

### 🟠 Altos (capacidad)

**H4. El `count(*)` del listado duplica la carga de BD innecesariamente**
Cada `GET /api/properties` lanza 2 queries (página + total). El total es lo primero que degrada bajo carga. El código ya deja preparada la paginación keyset (índice `(createdAt, id)` y comentario en `getProperties`).

*Fix:* cachear el total por filtro (TTL 30–60 s) o activar cursor-based pagination y soltar el `count` en listados públicos.

**H5. Sin caché del catálogo público**
Los listados anónimos (mayoría del tráfico) son idénticos entre usuarios. Un LRU en memoria con TTL 5–15 s absorbería la mayor parte de las queries y multiplicaría ×3–5 la capacidad actual. Es la mejora de mayor ROI.

**H6. Pool de conexiones sin tunear (y evidencia de que "más" no es mejor)**
Pool default de Prisma (~25). Prueba con `connection_limit=50`: el throughput **empeoró** (380 vs 538 rps) por contención en Postgres. No subir el pool a ciegas: medir con 30–40 y monitorear; si se escala horizontal, usar PgBouncer.

**H7. Rate limiter con store en memoria local**
`express-rate-limit` guarda un registro por IP única en memoria: creció ~45 MB con ~15k IPs sintéticas y no se limpia proactivamente. Además, si mañana hay 2+ instancias (auto-scaling), cada una lleva contadores propios (límite efectivo ×N).

*Fix:* aceptable hoy; al escalar horizontal migrar a store Redis y definir `max` coherente multi-instancia.

### 🟡 Medios / menores

- **H8.** `console.log` por conexión/desconexión de socket (`server.js`): 10k líneas durante las pruebas; stdout síncrono cuesta bajo picos. Usar niveles de log (pino/debug).
- **H9.** `onlineUsers` Map sobrescribe el socketId si un usuario abre 2 pestañas y borra la entrada al desconectarse una sola → estado inconsistente. Hoy solo alimenta `/api/health`, pero es una trampa futura para el chat.
- **H10.** `savedSearchNotifier` carga TODAS las búsquedas guardadas en memoria por cada propiedad creada (concurrencia bien limitada a 5). Vigilar cuando haya >100k búsquedas; considerar matching invertido por ciudad.
- **H11.** Handshake de Socket.IO hace 1 query a BD por conexión (`tokenVersion`); correcto para seguridad, pero miles de reconexiones móviles simultáneas pueden picar la BD. Cache de 30–60 s del `tokenVersion` por userId lo mitiga.

---

## 5. Mejoras recomendadas (orden por ROI)

| # | Acción | Esfuerzo | Impacto esperado |
|---|---|---|---|
| 1 | Fix CORS sin-Origin (H1) | 15 min | Evita caída total en producción (móvil + health checks) |
| 2 | Migración de `cedula` + CI anti-drift (H2) | 1–2 h | Deploy limpio funcional |
| 3 | Rotar secretos Cloudinary y sacarlos del repo (H3) | 1 h | Seguridad |
| 4 | Caché LRU del listado público TTL 5–15 s (H5) | Medio día | **×3–5 usuarios soportados** |
| 5 | Keyset pagination / caché de count (H4) | 1 día | Quita el count(*) del camino caliente |
| 6 | `compression` (gzip) en Express | 30 min | ~70% menos ancho de banda en listados (~40 KB JSON) |
| 7 | Tuning fino de pool + PgBouncer al escalar (H6) | 1 día | +10–20% techo BD |
| 8 | PM2 cluster / 2+ instancias Render (D) | 1 día | Node tiene 75% de headroom sin uso |
| 9 | Redis para rate-limit y sesiones socket al escalar (H7) | 1–2 días | Multi-instancia consistente |

Con las medidas 4+5+6 aplicadas, la misma infraestructura debería sostener razonablemente **10.000–15.000 usuarios simultáneos**, y el siguiente techo pasaría a ser Postgres vertical u réplicas de lectura.

---

## 6. Reproducir las pruebas

```bash
# 1. Base de datos de carga
docker compose up -d
cd backend
DATABASE_URL="postgresql://domify:domify_dev_password@localhost:5432/domify_loadtest?schema=public" npx prisma db push
DATABASE_URL="postgresql://domify:domify_dev_password@localhost:5432/domify_loadtest?schema=public" node scripts/seedLoadTest.js 50000
DATABASE_URL="postgresql://domify:domify_dev_password@localhost:5432/domify_loadtest?schema=public" node scripts/loadtest/createUsers.js 600

# 2. Servidor bajo prueba (producción)
NODE_ENV=production PORT=5001 DATABASE_URL="postgresql://domify:domify_dev_password@localhost:5432/domify_loadtest?schema=public" node src/server.js

# 3. Escenarios
node scripts/loadtest/run.js --scenario browse --vus 3000 --duration 60 --think 2000-8000 --pid <PID> --label prod-users-3000
node scripts/loadtest/ws.js   --vus 5000  --duration 45 --pid <PID> --label ws-5000
```

Resultados crudos: `backend/scripts/loadtest/results/`.
