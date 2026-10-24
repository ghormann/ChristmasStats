exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS name_queue (
            ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            normal_cnt INTEGER,
            low_cnt    INTEGER,
            ready_cnt  INTEGER,
            status     TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('name_queue', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS name_estimate (
            ts                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            estimated_seconds INTEGER,
            message           TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('name_estimate', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS sms_received (
            ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            phone          TEXT,
            body           TEXT,
            names          TEXT[],
            result         TEXT,
            quoted_seconds INTEGER,
            city           TEXT,
            state          TEXT,
            zip            TEXT,
            country        TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('sms_received', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS name_batch (
            ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            name         TEXT,
            source       TEXT,
            submitted_ts TIMESTAMPTZ
        )
    `);
    pgm.sql(`SELECT create_hypertable('name_batch', 'ts', if_not_exists => TRUE)`);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS website_visitors (
            ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            connected INTEGER
        )
    `);
    pgm.sql(`SELECT create_hypertable('website_visitors', 'ts', if_not_exists => TRUE)`);

    // Actual wait = start of the first Wish_Name playlist after the batch was
    // ready, minus when the name was submitted. Quoted wait comes from the
    // text that submitted it (same phone, same ts give or take clock rounding).
    pgm.sql(`
        CREATE OR REPLACE VIEW name_wait AS
        SELECT nb.ts AS batch_ts,
               nb.name,
               nb.source,
               nb.submitted_ts,
               d.displayed_ts,
               EXTRACT(EPOCH FROM d.displayed_ts - nb.submitted_ts)::int AS wait_seconds,
               q.quoted_seconds
        FROM name_batch nb
        LEFT JOIN LATERAL (
            SELECT MIN(e.ts) AS displayed_ts
            FROM event e
            WHERE e.name = 'planSong'
              AND e.argument = 'Internal_Wish_Name'
              AND e.ts >= nb.ts
              AND e.ts < nb.ts + INTERVAL '1 day'
        ) d ON TRUE
        LEFT JOIN LATERAL (
            SELECT s.quoted_seconds
            FROM sms_received s
            WHERE s.phone = nb.source
              AND s.ts BETWEEN nb.submitted_ts - INTERVAL '2 seconds' AND nb.submitted_ts + INTERVAL '2 seconds'
            ORDER BY s.ts DESC
            LIMIT 1
        ) q ON TRUE
        WHERE nb.source <> 'System'
    `);
};

exports.down = false;
