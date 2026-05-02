# Design: Migrate to PostgreSQL + TimescaleDB

**Date:** 2026-05-02  
**Branch:** hormann/postgress  
**Status:** Approved

## Overview

Migrate the ChristmasStats app container from MySQL 5.7 to an external PostgreSQL + TimescaleDB server already running in a k8s cluster. All 7 tables become TimescaleDB hypertables. Schema is versioned and auto-migrated on app startup using `node-pg-migrate`. `getPricePerKWH` moves from a hardcoded value in `db.js` to `greglights_config.json`. All PostgreSQL connection details come from environment variable secrets.

## 1. Configuration & Environment

### PostgreSQL env vars (replace `MYSQL_*`)

All connection details are supplied via environment variables. The `pg` library reads these by convention with no explicit config code required:

```
PGHOST=<host>
PGPORT=5432
PGUSER=<user>
PGPASSWORD=<secret>
PGDATABASE=christmas_stats_prod   # or christmas_stats_dev
```

`pg.env.sample` replaces `db.env.sample` with these keys.

### `greglights_config.json` — gains `pricePerKWH`

```json
{
  "username": "...",
  "password": "...",
  "host": "...",
  "port": 8883,
  "ca_file": "./path/to/ca/file",
  "send_enabled": false,
  "pricePerKWH": 0.12
}
```

## 2. Schema Migrations

### Library

`node-pg-migrate` added as a production dependency. Migrations run programmatically at app startup via the `runner` API (`import { runner } from 'node-pg-migrate'`) before MQTT connects.

### Migration files

Located in `app/migrations/` as numbered SQL files:

- `1_initial_schema.sql` — creates all 7 tables in PostgreSQL syntax and converts each to a TimescaleDB hypertable. Replaces `init.sql`.
- Future schema changes get new numbered files (e.g., `2_add_column.sql`).

### Tables and hypertables

All 7 tables are high-frequency time-series and become hypertables on `ts`:

| Table | Partition column |
|---|---|
| `name` | `ts` |
| `event` | `ts` |
| `song_vote` | `ts` |
| `snowman_vote` | `ts` |
| `power` | `ts` |
| `button` | `ts` |
| `sensor` | `ts` |

### MySQL → PostgreSQL SQL translation

| MySQL | PostgreSQL |
|---|---|
| `?` placeholders | `$1, $2, ...` numbered params |
| `now() - interval ? minute` | `NOW() - ($1 * INTERVAL '1 minute')` |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| `FLOAT` | `DOUBLE PRECISION` |
| `SMALLINT` | `SMALLINT` (unchanged) |
| `VARCHAR(255)` | `TEXT` |

### Startup sequence

1. `index.js` loads `greglights_config.json`
2. `db.connect()` runs a `SELECT 1` to verify PostgreSQL connectivity — throws and crash-loops if unreachable
3. `node-pg-migrate` runs programmatically — creates `pgmigrations` tracking table on first run, applies any pending migrations in order
4. `mymqtt.init(config)` connects to MQTT and begins normal operation
5. If any step fails, the process exits (k8s restarts the pod)

## 3. `db.js` Rewrite

### Dependencies

- `mysql` removed
- `pg` added
- `moment` removed (PostgreSQL date arithmetic replaces it)

### Connection pool

A single `pg.Pool` instance reads `PG*` env vars automatically. Exports an `async connect()` function that validates connectivity with `SELECT 1`.

### Query pattern

All functions rewritten as `async/await`. The `myQuery` callback wrapper is removed entirely.

```js
// before
function getTopButtons(minutes) {
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            rc = [];
            results.forEach((r) => { rc.push({ button: r.button, cnt: r.CNT }); });
            resolve(rc);
        });
    });
}

// after
async function getTopButtons(minutes) {
    const { rows } = await pool.query(
        `SELECT button, count(1) cnt FROM button WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY button ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ button: r.button, cnt: r.cnt }));
}
```

### `getPricePerKWH` removal

- Removed from `db.js` and from module exports
- `index.js` passes the loaded config to `mymqtt.init(config)`
- `mymqtt.js` reads `config.pricePerKWH` in `publishTodayPower()`
- `db.getTotalPower()` and `db.getSongPower()` return raw power values; the caller applies the price multiplier

## 4. Docker Compose Changes

`docker-compose.yml` is simplified:

- `database` service removed
- `dbdata` volume removed
- `app` service:
  - `env_file` changed from `db.env` to `pg.env`
  - Volume added: `./greglights_config.json:/app/greglights_config.json:ro`
- `grafana` service: `depends_on: database` dependency removed

## 5. K8s Deployment

See `docs/k8s-deployment.md` for full YAML examples. Summary:

- **Namespace:** `gjh-christmas`
- **`greglights-config` Secret** — stores `config.json` (MQTT settings + `pricePerKWH`), mounted as a volume into the app container
- **`postgres-credentials` Secret** — stores `PG*` env vars, referenced via `envFrom` in the pod spec
- Migrations run automatically on pod startup — no manual init step or init container required

## 6. File Changes

### Removed
- `init.sql`
- `db.env.sample`

### Added
- `pg.env.sample`
- `app/migrations/1_initial_schema.sql`
- `docs/k8s-deployment.md`

### Modified
- `docker-compose.yml`
- `app/lib/db.js`
- `app/index.js`
- `app/lib/mymqtt.js`
- `app/package.json`
- `app/greglights_config_example.json`
