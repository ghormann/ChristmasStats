exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS car_counting (
            ts                 TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
            camera             TEXT,
            count              INTEGER,
            processing_seconds DOUBLE PRECISION,
            status             TEXT
        )
    `);
    pgm.sql(`SELECT create_hypertable('car_counting', 'ts', if_not_exists => TRUE)`);
};

exports.down = false;
