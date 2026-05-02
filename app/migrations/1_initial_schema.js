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
