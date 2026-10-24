// christmasnamechecker now sends one sms/received message per name (valid
// names keep their result, invalid ones are "rejected"), so sms_received
// holds one row per name instead of an array of the valid names.
exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE sms_received ADD COLUMN IF NOT EXISTS name TEXT`);

    // Split any rows recorded in the old array format into one row per name.
    pgm.sql(`
        INSERT INTO sms_received (ts, phone, body, name, result, quoted_seconds, city, state, zip, country)
        SELECT s.ts, s.phone, s.body, n, s.result, s.quoted_seconds, s.city, s.state, s.zip, s.country
        FROM sms_received s, unnest(s.names) AS n
        WHERE cardinality(s.names) > 0
    `);
    pgm.sql(`DELETE FROM sms_received WHERE cardinality(names) > 0`);
    pgm.sql(`ALTER TABLE sms_received DROP COLUMN names`);

    // Now that each row is one name, match the quote on the name too.
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
              AND s.name = nb.name
              AND s.ts BETWEEN nb.submitted_ts - INTERVAL '2 seconds' AND nb.submitted_ts + INTERVAL '2 seconds'
            ORDER BY s.ts DESC
            LIMIT 1
        ) q ON TRUE
        WHERE nb.source <> 'System'
    `);
};

exports.down = false;
