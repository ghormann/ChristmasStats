# PostgreSQL + TimescaleDB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the ChristmasStats app from MySQL 5.7 to an external PostgreSQL + TimescaleDB server, with auto-migrations on startup, all 7 tables as hypertables, and `pricePerKWH` sourced from config.

**Architecture:** The `app` container connects to an existing external PostgreSQL/TimescaleDB server (k8s-hosted). On startup, `index.js` verifies DB connectivity, runs `node-pg-migrate` to apply any pending schema migrations, then starts MQTT. `greglights_config.json` is mounted as a read-only volume; all PG connection details come from `PG*` environment variable secrets.

**Tech Stack:** Node.js, `pg` (node-postgres), `node-pg-migrate`, Jest (tests), PostgreSQL + TimescaleDB, docker-compose (local), k8s (production)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `app/package.json` | Remove mysql/moment, add pg/node-pg-migrate/jest |
| Create | `app/migrations/1_initial_schema.js` | All 7 tables + TimescaleDB hypertables |
| Create | `app/__tests__/db.test.js` | Unit tests for db.js |
| Modify | `app/lib/db.js` | Rewrite with pg + async/await, remove getPricePerKWH |
| Modify | `app/index.js` | Config load, db.connect(), migrations, pass config to mymqtt |
| Modify | `app/lib/mymqtt.js` | Accept config param, apply pricePerKWH in caller |
| Modify | `app/greglights_config_example.json` | Add pricePerKWH field |
| Create | `pg.env.sample` | Sample PG* env vars |
| Delete | `db.env.sample` | Replaced by pg.env.sample |
| Delete | `init.sql` | Replaced by migration file |
| Modify | `docker-compose.yml` | Remove database service, mount config, use pg.env |
| Create | `docs/k8s-deployment.md` | K8s deployment guide with inline YAML |

---

## Task 1: Update dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Update package.json**

Replace the contents of `app/package.json` with:

```json
{
  "name": "christmaslogger",
  "version": "1.0.0",
  "description": "Loggs MQTT events",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "start": "node index.js"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "mqtt": "^5.10.1",
    "mqtt-pattern": "^2.1.0",
    "node-pg-migrate": "^7.0.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

- [ ] **Step 2: Install updated dependencies**

```bash
cd app && npm install
```

Expected: `node_modules` updated, `package-lock.json` updated, no errors.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "deps: replace mysql/moment with pg and node-pg-migrate, add jest"
```

---

## Task 2: Create the initial schema migration

**Files:**
- Create: `app/migrations/1_initial_schema.js`

- [ ] **Step 1: Create migrations directory and file**

Create `app/migrations/1_initial_schema.js`:

```js
exports.up = (pgm) => {
    pgm.sql('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS name (
            ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            name      TEXT,
            name_type TEXT,
            source    TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('name', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS event (
            ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            name     TEXT,
            argument TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('event', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS song_vote (
            ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            playlist TEXT,
            source   TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('song_vote', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS snowman_vote (
            ts      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            snowman TEXT,
            source  TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('snowman_vote', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS power (
            ts     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
            song   TEXT,
            sensor SMALLINT,
            total  DOUBLE PRECISION,
            s1     DOUBLE PRECISION,
            s2     DOUBLE PRECISION,
            s3     DOUBLE PRECISION,
            s4     DOUBLE PRECISION,
            s5     DOUBLE PRECISION,
            s6     DOUBLE PRECISION,
            s7     DOUBLE PRECISION,
            s8     DOUBLE PRECISION,
            s9     DOUBLE PRECISION
        )
    `);
    pgm.sql(`SELECT create_hypertable('power', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS button (
            ts     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            button TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('button', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS sensor (
            ts     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
            device TEXT,
            sensor TEXT,
            value  DOUBLE PRECISION,
            label  TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('sensor', 'ts', if_not_exists => TRUE)`);
};

exports.down = false;
```

- [ ] **Step 2: Commit**

```bash
git add app/migrations/1_initial_schema.js
git commit -m "feat: add initial PostgreSQL + TimescaleDB schema migration"
```

---

## Task 3: Write tests for db.js (TDD)

**Files:**
- Create: `app/__tests__/db.test.js`

- [ ] **Step 1: Create the test file**

Create `app/__tests__/db.test.js`:

```js
let db;
let mockQuery;

beforeEach(() => {
    jest.resetModules();
    mockQuery = jest.fn();
    jest.doMock('pg', () => ({
        Pool: jest.fn(() => ({ query: mockQuery })),
    }));
    db = require('../lib/db');
});

describe('connect', () => {
    it('runs SELECT 1 to verify connectivity', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.connect();
        expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });
});

describe('insertButton', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertButton('red');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO button (button) VALUES ($1)',
            ['red']
        );
    });
});

describe('insertEvent', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertEvent('planSong', 'Jingle_Bells');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO event (name, argument) VALUES ($1, $2)',
            ['planSong', 'Jingle_Bells']
        );
    });
});

describe('insertSensor', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertSensor('fpp2', 'tF', 72.5, 'temperature');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO sensor (device, sensor, value, label) VALUES ($1, $2, $3, $4)',
            ['fpp2', 'tF', 72.5, 'temperature']
        );
    });
});

describe('insertName', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertName('GREG', 'phone', 'Normal');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO name (name, source, name_type) VALUES ($1, $2, $3)',
            ['GREG', 'phone', 'Normal']
        );
    });
});

describe('insertVote', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertVote('Jingle_Bells', 'phone123');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO song_vote (playlist, source) VALUES ($1, $2)',
            ['Jingle_Bells', 'phone123']
        );
    });
});

describe('insertSnowmanVote', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertSnowmanVote('Frosty', 'phone123');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO snowman_vote (snowman, source) VALUES ($1, $2)',
            ['Frosty', 'phone123']
        );
    });
});

describe('insertPower', () => {
    it('inserts with correct SQL and spread params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const data = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9];
        await db.insertPower('Jingle_Bells', 1, 42.0, data);
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO power (song, sensor, total, s1, s2, s3, s4, s5, s6, s7, s8, s9) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            ['Jingle_Bells', 1, 42.0, ...data]
        );
    });
});

describe('getTopButtons', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ button: 'red', cnt: '5' }] });
        const result = await db.getTopButtons(60);
        expect(result).toEqual([{ button: 'red', cnt: '5' }]);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('button'), [60]);
    });
});

describe('getTopNames', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ name: 'GREG', cnt: '10' }] });
        const result = await db.getTopNames(60);
        expect(result).toEqual([{ name: 'GREG', cnt: '10' }]);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('name'), [60]);
    });
});

describe('getTopVotes', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ playlist: 'Jingle_Bells', cnt: '3' }] });
        const result = await db.getTopVotes(60);
        expect(result).toEqual([{ playlist: 'Jingle_Bells', cnt: '3' }]);
    });
});

describe('getTopSnowmenVotes', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ snowman: 'Frosty', cnt: '7' }] });
        const result = await db.getTopSnowmenVotes(60);
        expect(result).toEqual([{ snowman: 'Frosty', cnt: '7' }]);
    });
});

describe('getTotalPower', () => {
    it('returns computed power fields without dollars', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ power_total: '100', power_average: '10', cnt: '360' }],
        });
        const result = await db.getTotalPower(60);
        expect(result).toHaveProperty('kwh');
        expect(result).toHaveProperty('wattSeconds');
        expect(result).toHaveProperty('minutes');
        expect(result).toHaveProperty('avgWatt');
        expect(result).not.toHaveProperty('dollars');
    });

    it('returns null when no rows', async () => {
        mockQuery.mockResolvedValue({ rows: [{ power_total: null, power_average: null, cnt: '0' }] });
        const result = await db.getTotalPower(60);
        expect(result).toBeNull();
    });
});

describe('getSongPower', () => {
    it('returns array with computed fields without dollars', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ song: 'Jingle_Bells', power_total: '50', power_average: '5', cnt: '180' }],
        });
        const result = await db.getSongPower(60);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('song', 'Jingle_Bells');
        expect(result[0]).toHaveProperty('kwh');
        expect(result[0]).not.toHaveProperty('dollars');
    });
});

describe('getUniqueVoters', () => {
    it('returns array of time period voter counts', async () => {
        mockQuery.mockResolvedValue({ rows: [{ cnt: '5' }] });
        const result = await db.getUniqueVoters();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('cnt');
    });
});

describe('getUniquePhones', () => {
    it('returns array of time period phone counts', async () => {
        mockQuery.mockResolvedValue({ rows: [{ cnt: '3' }] });
        const result = await db.getUniquePhones();
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('cnt');
    });
});

describe('getPowerToday', () => {
    it('returns today power summary', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ cnt: '100', tot: '500', mints: new Date() }],
        });
        const result = await db.getPowerToday();
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('cnt');
        expect(result).toHaveProperty('mints');
    });
});
```

- [ ] **Step 2: Run tests — expect all to fail (db.js not yet rewritten)**

```bash
cd app && npm test
```

Expected: tests fail with errors about `mysql` or wrong exports.

---

## Task 4: Rewrite db.js

**Files:**
- Modify: `app/lib/db.js`

- [ ] **Step 1: Replace db.js entirely**

Replace the full contents of `app/lib/db.js` with:

```js
const { Pool } = require('pg');

const pool = new Pool(); // reads PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE from env

async function connect() {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
}

async function insertPower(song, sensor, total, data) {
    await pool.query(
        'INSERT INTO power (song, sensor, total, s1, s2, s3, s4, s5, s6, s7, s8, s9) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [song, sensor, total, ...data]
    );
}

async function insertSensor(device, sensor, value, label) {
    await pool.query(
        'INSERT INTO sensor (device, sensor, value, label) VALUES ($1, $2, $3, $4)',
        [device, sensor, value, label]
    );
}

async function insertName(name, source, type) {
    await pool.query(
        'INSERT INTO name (name, source, name_type) VALUES ($1, $2, $3)',
        [name, source, type]
    );
}

async function insertButton(button) {
    await pool.query(
        'INSERT INTO button (button) VALUES ($1)',
        [button]
    );
}

async function insertEvent(name, argument) {
    await pool.query(
        'INSERT INTO event (name, argument) VALUES ($1, $2)',
        [name, argument]
    );
}

async function insertSnowmanVote(name, source) {
    await pool.query(
        'INSERT INTO snowman_vote (snowman, source) VALUES ($1, $2)',
        [name, source]
    );
}

async function insertVote(playlist, source) {
    await pool.query(
        'INSERT INTO song_vote (playlist, source) VALUES ($1, $2)',
        [playlist, source]
    );
}

async function getUniquePhones() {
    const periods = [
        { minutes: 15,     label: '15 min' },
        { minutes: 30,     label: '30 min' },
        { minutes: 60,     label: '1 hour' },
        { minutes: 120,    label: '2 hours' },
        { minutes: 240,    label: '4 hours' },
        { minutes: 1440,   label: '1 day' },
        { minutes: 432000, label: '1 year' },
    ];
    return Promise.all(periods.map(async (p) => {
        const { rows } = await pool.query(
            `SELECT COUNT(DISTINCT source) cnt FROM name WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
            [p.minutes]
        );
        return { ...p, cnt: rows[0].cnt };
    }));
}

async function getTopNames(minutes) {
    const { rows } = await pool.query(
        `SELECT name, COUNT(1) cnt FROM name WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY name ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ name: r.name, cnt: r.cnt }));
}

async function getTopButtons(minutes) {
    const { rows } = await pool.query(
        `SELECT button, COUNT(1) cnt FROM button WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY button ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ button: r.button, cnt: r.cnt }));
}

async function getPowerToday() {
    const { rows } = await pool.query(
        `SELECT COUNT(1) cnt, SUM(total) tot, MIN(ts) mints FROM power WHERE ts > CURRENT_DATE - INTERVAL '5 hours'`
    );
    const r = rows[0];
    return { total: r.tot, cnt: r.cnt, mints: r.mints };
}

async function getTopPlayedSongs(minutes) {
    const { rows } = await pool.query(
        `SELECT argument, COUNT(1) cnt FROM event WHERE name = 'planSong'
         AND argument NOT IN ('TuneTo','off','Intro','Good_Night','TheHormanns')
         AND argument NOT LIKE 'Test%' AND argument NOT LIKE 'Internal%' AND argument NOT LIKE 'Midnight%'
         AND ts > NOW() - ($1 * INTERVAL '1 minute')
         GROUP BY argument ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ name: r.argument, cnt: r.cnt }));
}

async function getUniqueVoters() {
    const periods = [
        { minutes: 15,     label: '15 min' },
        { minutes: 30,     label: '30 min' },
        { minutes: 60,     label: '1 hour' },
        { minutes: 120,    label: '2 hours' },
        { minutes: 240,    label: '4 hours' },
        { minutes: 1440,   label: '1 day' },
        { minutes: 432000, label: '1 year' },
    ];
    return Promise.all(periods.map(async (p) => {
        const { rows } = await pool.query(
            `SELECT COUNT(DISTINCT source) cnt FROM song_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
            [p.minutes]
        );
        return { ...p, cnt: rows[0].cnt };
    }));
}

async function getTotalPower(minutes) {
    const { rows } = await pool.query(
        `SELECT SUM(total) power_total, AVG(total) power_average, COUNT(1) cnt FROM power WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
        [minutes]
    );
    const r = rows[0];
    if (!r.power_total) return null;
    const wattSeconds = Math.round(115 * r.power_total * 100) / 100;
    const mins       = Math.round((r.cnt / 60) * 100) / 100;
    const kwh        = Math.round((wattSeconds / 3600000) * 100) / 100;
    const avgWatt    = Math.round((r.power_average * 115) * 100) / 100;
    return { wattSeconds, minutes: mins, kwh, avgWatt };
}

async function getSongPower(minutes) {
    const { rows } = await pool.query(
        `SELECT song, SUM(total) power_total, AVG(total) power_average, COUNT(1) cnt FROM power
         WHERE ts > NOW() - ($1 * INTERVAL '1 minute')
         AND song NOT LIKE 'Test%' AND song NOT LIKE 'Internal%' AND song NOT LIKE 'Midnight%'
         GROUP BY song ORDER BY 2 DESC`,
        [minutes]
    );
    return rows.map(r => {
        const wattSeconds = Math.round(115 * r.power_total * 100) / 100;
        const mins        = Math.round((r.cnt / 60) * 100) / 100;
        const kwh         = Math.round((wattSeconds / 3600000) * 100) / 100;
        const avgWatt     = Math.round((r.power_average * 115) * 100) / 100;
        return { song: r.song, wattSeconds, minutes: mins, kwh, avgWatt };
    });
}

async function getTopVotes(minutes) {
    const { rows } = await pool.query(
        `SELECT playlist, COUNT(1) cnt FROM song_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY playlist ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ playlist: r.playlist, cnt: r.cnt }));
}

async function getTopSnowmenVotes(minutes) {
    const { rows } = await pool.query(
        `SELECT snowman, COUNT(1) cnt FROM snowman_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY snowman ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ snowman: r.snowman, cnt: r.cnt }));
}

module.exports = {
    connect,
    insertName,
    insertSnowmanVote,
    getTopNames,
    getTopVotes,
    getUniqueVoters,
    getTopPlayedSongs,
    insertVote,
    insertEvent,
    insertPower,
    insertButton,
    getSongPower,
    getTotalPower,
    getPowerToday,
    getTopSnowmenVotes,
    getTopButtons,
    getUniquePhones,
    insertSensor,
};
```

- [ ] **Step 2: Run tests — expect all to pass**

```bash
cd app && npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/lib/db.js app/__tests__/db.test.js
git commit -m "feat: rewrite db.js with pg + async/await, remove getPricePerKWH and moment"
```

---

## Task 5: Update index.js

**Files:**
- Modify: `app/index.js`

- [ ] **Step 1: Replace index.js**

Replace the full contents of `app/index.js` with:

```js
const fs = require('fs');
const path = require('path');
const { runner } = require('node-pg-migrate');
const db = require('./lib/db');
const mymqtt = require('./lib/mymqtt');

async function runMigrations() {
    const { PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE } = process.env;
    const databaseUrl = `postgres://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE}`;
    await runner({
        databaseUrl,
        migrationsTable: 'pgmigrations',
        dir: path.resolve(__dirname, 'migrations'),
        direction: 'up',
        count: Infinity,
    });
}

const start = async () => {
    const config = JSON.parse(fs.readFileSync('greglights_config.json', 'utf8'));

    console.log('Connecting to PostgreSQL...');
    await db.connect();

    console.log('Running migrations...');
    await runMigrations();

    console.log('Starting MQTT');
    mymqtt.init(config);
};

start().catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Run tests to confirm nothing broken**

```bash
cd app && npm test
```

Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add app/index.js
git commit -m "feat: add config load, db connect, and migration runner to startup sequence"
```

---

## Task 6: Update mymqtt.js

**Files:**
- Modify: `app/lib/mymqtt.js`

- [ ] **Step 1: Add config parameter to init() and use pricePerKWH from config**

Apply these changes to `app/lib/mymqtt.js`:

**a)** Add a module-level `config` variable at the top (after the existing `var` declarations):

```js
var config = {};
```

**b)** Change the `publishTodayPower` function — replace `db.getPricePerKWH()` with `config.pricePerKWH`:

```js
function publishTodayPower() {
    let topic = '/christmas/todayPower';
    let wattSeconds = 115 * today_power.total;
    let hours = today_power.cnt / 3600;
    let kwh = wattSeconds / 3600000;
    let dollars = kwh * config.pricePerKWH;
    let cnt = today_power.cnt;
    let avgWatt = (kwh / hours) * 1000;
    let rc = { hours, avgWatt, kwh, dollars, cnt };
    client.publish(topic, JSON.stringify(rc), {}, function (err) {
        if (err) {
            console.log('Error publishing topic: ', topic);
            console.log(err);
        }
    });
}
```

**c)** Add two helper functions before `publishResults`:

```js
function addDollars(powerResult, pricePerKWH) {
    if (!powerResult) return powerResult;
    return { ...powerResult, dollars: Math.round(powerResult.kwh * pricePerKWH * 100) / 100 };
}

function addSongDollars(songs, pricePerKWH) {
    return songs.map(s => ({ ...s, dollars: Math.round(s.kwh * pricePerKWH * 100) / 100 }));
}
```

**d)** Update `publishResults` to apply dollars via helpers. Replace the `rc` object inside `publishResults`:

```js
rc = {
    songPower_1hr:        addSongDollars(await db.getSongPower(60), config.pricePerKWH),
    songPower_24hr:       addSongDollars(await db.getSongPower(1440), config.pricePerKWH),
    totalPower_1hr:       addDollars(await db.getTotalPower(60), config.pricePerKWH),
    totalPower_24hr:      addDollars(await db.getTotalPower(1440), config.pricePerKWH),
    totalPower_year:      addDollars(await getYearPower(), config.pricePerKWH),
    topNames_1hr:         await db.getTopNames(60),
    topNames_24hr:        await db.getTopNames(1440),
    topNames_year:        await db.getTopNames(288000),
    topButton_1hr:        await db.getTopButtons(60),
    topButton_12hr:       await db.getTopButtons(720),
    topButton_24hr:       await db.getTopButtons(1440),
    topButton_year:       await db.getTopButtons(288000),
    topSongs_15min:       await db.getTopVotes(15),
    topSongs_1hr:         await db.getTopVotes(60),
    topSongs_24hr:        await db.getTopVotes(1440),
    topSongs_year:        await db.getTopVotes(288000),
    topSnowmen_1hr:       await db.getTopSnowmenVotes(60),
    topSnowmen_24hr:      await db.getTopSnowmenVotes(1440),
    topSnowmen_year:      await db.getTopSnowmenVotes(288000),
    topPlayedSongs_1hr:   await db.getTopPlayedSongs(60),
    topPlayedSongs_24hr:  await db.getTopPlayedSongs(1440),
    topPlayedSongs_year:  await db.getTopPlayedSongs(288000),
    topVoters:            await db.getUniqueVoters(),
    topPhones:            await db.getUniquePhones(),
    uptime:               process.uptime(),
};
```

**e)** Remove the `fs` require at the top of `mymqtt.js` — it's no longer needed since config is passed in. Delete this line:

```js
const fs = require("fs");
```

**f)** Update the `init` function signature to accept and store config. Replace:

```js
function init() {
    let rawdata = fs.readFileSync("greglights_config.json");
    let config = JSON.parse(rawdata);
```

With:

```js
function init(cfg) {
    config = cfg;
```

- [ ] **Step 2: Run tests to confirm nothing broken**

```bash
cd app && npm test
```

Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add app/lib/mymqtt.js
git commit -m "feat: accept config param in mymqtt.init, apply pricePerKWH from config"
```

---

## Task 7: Update config and env sample files

**Files:**
- Modify: `app/greglights_config_example.json`
- Create: `pg.env.sample`
- Delete: `db.env.sample`

- [ ] **Step 1: Update greglights_config_example.json**

Replace the contents of `app/greglights_config_example.json` with:

```json
{
  "username": "username",
  "password": "password",
  "ca_file": "./path/to/ca/file",
  "port": 8883,
  "host": "test.mqtt.org",
  "send_enabled": false,
  "pricePerKWH": 0.12
}
```

- [ ] **Step 2: Create pg.env.sample**

Create `/home/ghormann/src/ChristmasStats/pg.env.sample` with:

```
PGHOST=your-postgres-host
PGPORT=5432
PGUSER=christmas_user
PGPASSWORD=your-password
PGDATABASE=christmas_stats_prod
```

- [ ] **Step 3: Delete db.env.sample**

```bash
git rm db.env.sample
```

- [ ] **Step 4: Commit**

```bash
git add app/greglights_config_example.json pg.env.sample
git commit -m "config: add pricePerKWH to example config, replace db.env.sample with pg.env.sample"
```

---

## Task 8: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace docker-compose.yml**

Replace the full contents of `docker-compose.yml` with:

```yaml
version: '3'

volumes:
  grafana_lib:
    driver: local

services:
  app:
    build: app/.
    env_file:
      - pg.env
    volumes:
      - ./greglights_config.json:/app/greglights_config.json:ro
    restart: always
    extra_hosts:
      xmas-hp.hormann.local: 192.168.0.212

  grafana:
    image: grafana/grafana
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - grafana_lib:/var/lib/grafana
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: remove database container from docker-compose, mount config as volume"
```

---

## Task 9: Remove init.sql

- [ ] **Step 1: Delete init.sql**

```bash
git rm init.sql
git commit -m "chore: remove init.sql, replaced by node-pg-migrate migration"
```

---

## Task 10: Create docs/k8s-deployment.md

**Files:**
- Create: `docs/k8s-deployment.md`

- [ ] **Step 1: Create the deployment guide**

Create `docs/k8s-deployment.md` with:

````markdown
# Kubernetes Deployment Guide

Namespace: `gjh-christmas`

The app requires two Secrets: one for PostgreSQL credentials (injected as env vars) and one for the greglights config (mounted as a file).

Migrations run automatically when the pod starts — no manual init step is needed.

---

## 1. PostgreSQL Credentials Secret

Create this Secret with your actual connection details:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: gjh-christmas
type: Opaque
stringData:
  PGHOST: "your-postgres-host"
  PGPORT: "5432"
  PGUSER: "christmas_user"
  PGPASSWORD: "your-password"
  PGDATABASE: "christmas_stats_prod"
```

Apply:
```bash
kubectl apply -f postgres-credentials-secret.yaml
```

---

## 2. greglights Config Secret

The app config is stored as a Secret and mounted as a file at `/app/greglights_config.json` inside the container.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: greglights-config
  namespace: gjh-christmas
type: Opaque
stringData:
  config.json: |
    {
      "username": "mqtt-user",
      "password": "mqtt-password",
      "host": "mqtt.example.com",
      "port": 8883,
      "ca_file": "/etc/certs/ca.crt",
      "send_enabled": true,
      "pricePerKWH": 0.12
    }
```

Apply:
```bash
kubectl apply -f greglights-config-secret.yaml
```

---

## 3. App Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: christmas-stats
  namespace: gjh-christmas
spec:
  replicas: 1
  selector:
    matchLabels:
      app: christmas-stats
  template:
    metadata:
      labels:
        app: christmas-stats
    spec:
      containers:
        - name: app
          image: your-registry/christmas-stats-app:latest
          envFrom:
            - secretRef:
                name: postgres-credentials
          volumeMounts:
            - name: greglights-config
              mountPath: /app/greglights_config.json
              subPath: config.json
              readOnly: true
      volumes:
        - name: greglights-config
          secret:
            secretName: greglights-config
```

Apply:
```bash
kubectl apply -f deployment.yaml
```

---

## 4. Verify startup

Check that migrations ran and MQTT connected:

```bash
kubectl logs -n gjh-christmas deployment/christmas-stats
```

Expected log lines:
```
Connecting to PostgreSQL...
Connected to PostgreSQL
Running migrations...
Starting MQTT
MQTT Connect
```

---

## Notes

- The PostgreSQL database (`PGDATABASE`) must already exist on the server. The app creates tables and hypertables via migrations but does not create the database itself.
- TimescaleDB extension must be installed in the target database, or the migration user must have `CREATE EXTENSION` privileges.
- To use the dev database, set `PGDATABASE: "christmas_stats_dev"` in the `postgres-credentials` Secret.
````

- [ ] **Step 2: Commit**

```bash
git add docs/k8s-deployment.md
git commit -m "docs: add k8s deployment guide with Secret and Deployment YAML examples"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
cd app && npm test
```

Expected: all tests pass.

- [ ] **Verify no references to mysql or moment remain**

```bash
grep -r "require.*mysql\|require.*moment" app/
```

Expected: no output.

- [ ] **Verify no references to getPricePerKWH remain**

```bash
grep -r "getPricePerKWH" app/
```

Expected: no output.

- [ ] **Verify greglights_config.json is read only once (in index.js)**

```bash
grep -r "greglights_config\|readFileSync" app/lib/
```

Expected: no output (all config reading is in `app/index.js`).
