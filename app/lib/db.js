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

async function insertCarCount(camera, count, processing_seconds, status) {
    await pool.query(
        'INSERT INTO car_counting (camera, count, processing_seconds, status) VALUES ($1, $2, $3, $4)',
        [camera, count, processing_seconds, status]
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
            `SELECT COUNT(DISTINCT source)::int cnt FROM name WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
            [p.minutes]
        );
        return { ...p, cnt: rows[0].cnt };
    }));
}

async function getTopNames(minutes) {
    const { rows } = await pool.query(
        `SELECT name, COUNT(1)::int cnt FROM name WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY name ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ name: r.name, cnt: r.cnt }));
}

async function getTopButtons(minutes) {
    const { rows } = await pool.query(
        `SELECT button, COUNT(1)::int cnt FROM button WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY button ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ button: r.button, cnt: r.cnt }));
}

async function getPowerToday() {
    const { rows } = await pool.query(
        `SELECT COUNT(1)::int cnt, SUM(total)::float8 tot, MIN(ts) mints FROM power WHERE ts > CURRENT_DATE - INTERVAL '5 hours'`
    );
    const r = rows[0];
    return { total: r.tot, cnt: r.cnt, mints: r.mints };
}

async function getTopPlayedSongs(minutes) {
    const { rows } = await pool.query(
        `SELECT argument, COUNT(1)::int cnt FROM event WHERE name = 'planSong'
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
            `SELECT COUNT(DISTINCT source)::int cnt FROM song_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
            [p.minutes]
        );
        return { ...p, cnt: rows[0].cnt };
    }));
}

async function getTotalPower(minutes) {
    const { rows } = await pool.query(
        `SELECT SUM(total)::float8 power_total, AVG(total)::float8 power_average, COUNT(1)::int cnt FROM power WHERE ts > NOW() - ($1 * INTERVAL '1 minute')`,
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
        `SELECT song, SUM(total)::float8 power_total, AVG(total)::float8 power_average, COUNT(1)::int cnt FROM power
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
        `SELECT playlist, COUNT(1)::int cnt FROM song_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY playlist ORDER BY 2 DESC LIMIT 20`,
        [minutes]
    );
    return rows.map(r => ({ playlist: r.playlist, cnt: r.cnt }));
}

async function getTopSnowmenVotes(minutes) {
    const { rows } = await pool.query(
        `SELECT snowman, COUNT(1)::int cnt FROM snowman_vote WHERE ts > NOW() - ($1 * INTERVAL '1 minute') GROUP BY snowman ORDER BY 2 DESC LIMIT 20`,
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
    insertCarCount,
};
