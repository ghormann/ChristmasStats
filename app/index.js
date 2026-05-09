require('dotenv').config();
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

const REQUIRED_CONFIG_FIELDS = ['host', 'port', 'username', 'password', 'pricePerKWH'];

function validateConfig(config) {
    const missing = REQUIRED_CONFIG_FIELDS.filter(f => !(f in config));
    if (missing.length > 0) {
        console.error(`Missing required config fields in greglights_config.json: ${missing.join(', ')}`);
        process.exit(1);
    }
}

const start = async () => {
    const configPath = path.resolve('greglights_config.json');
    console.log("reading config from ", configPath);
    const config = JSON.parse(fs.readFileSync('greglights_config.json', 'utf8'));
    validateConfig(config);

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
