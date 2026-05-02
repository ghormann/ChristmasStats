# Christmas Stats

A Node.js service that monitors MQTT traffic from a Christmas light show and stores time-series data for display and analysis. It subscribes to topics published by [Christmas Vote Now](https://github.com/ghormann/Christmas-Vote-now) and supporting hardware, then aggregates and republishes statistics every minute.

## Overview

The service bridges your MQTT broker and a TimescaleDB (PostgreSQL) database. It:

- Records **power consumption** per song and per circuit breaker
- Tracks **song votes** and **snowman votes** from visitors
- Logs **visitor name displays** triggered from phones
- Captures **FPP player status**, uptime, and sensor readings from Falcon Player instances
- Stores **Shelly device data** (temperature, humidity, battery)
- Records **button presses** from physical FPP buttons
- Publishes aggregated stats back to `/christmas/vote/stats` every 60 seconds and current power to `/christmas/todayPower` every 2 seconds

## MQTT Topics Subscribed

| Topic                                                | Data stored                         |
| ---------------------------------------------------- | ----------------------------------- |
| `/christmas/power/Power1`                            | Per-circuit amperage, running total |
| `/christmas/falcon/player/+/fppd_status`             | FPP sensors, uptime                 |
| `/christmas/falcon/player/fpp2/playlist_details`     | Active playlist / song name         |
| `/christmas/falcon/player/fpp2/playlist/name/status` | Song play events                    |
| `/christmas/vote/add`                                | Song votes                          |
| `/christmas/snowmanvote/add`                         | Snowman votes                       |
| `/christmas/FPPButton/+`                             | Physical button presses             |
| `/christmas/personsName`                             | Visitor name (normal display)       |
| `/christmas/personsNameFront`                        | Visitor name (front display)        |
| `/christmas/personsNameLow`                          | Visitor name (low display)          |
| `/christmas/nameAction`                              | Name action events                  |
| `shelly/+/status/temperature:0`                      | Shelly temperature                  |
| `shelly/+/status/humidity:0`                         | Shelly humidity                     |
| `shelly/+/status/devicepower:0`                      | Shelly battery percent/voltage      |

## Database Schema

All tables are TimescaleDB hypertables partitioned by timestamp (`ts`). Migrations run automatically on startup.

| Table          | Columns                          |
| -------------- | -------------------------------- |
| `power`        | ts, song, sensor, total, s1–s9   |
| `song_vote`    | ts, playlist, source             |
| `snowman_vote` | ts, snowman, source              |
| `name`         | ts, name, name_type, source      |
| `event`        | ts, name, argument               |
| `button`       | ts, button                       |
| `sensor`       | ts, device, sensor, value, label |

## Prerequisites

- [TimescaleDB](https://docs.timescale.com/) (PostgreSQL with the TimescaleDB extension installed)
- An MQTT broker reachable from the container
- Node.js 18+ (if running outside Docker)

## Configuration

### 1. MQTT + App config — `greglights_config.json`

Copy the example and fill in your values:

```bash
cp app/greglights_config_example.json app/greglights_config.json
```

```json
{
  "host": "mqtt.example.com",
  "port": 1883,
  "username": "mqtt-user",
  "password": "mqtt-password",
  "ca_file": "./path/to/ca/file",
  "send_enabled": true,
  "pricePerKWH": 0.12
}
```

| Field                   | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `host`                  | MQTT broker hostname                              |
| `port`                  | MQTT broker port (typically 1883 or 8883 for TLS) |
| `username` / `password` | MQTT credentials                                  |
| `ca_file`               | Path to CA certificate (for TLS)                  |
| `send_enabled`          | Whether to publish stats back to MQTT             |
| `pricePerKWH`           | Electricity rate used to calculate cost estimates |

### 2. PostgreSQL credentials — `pg.env`

```bash
cp pg.env.sample pg.env
```

```ini
PGHOST=your-postgres-host
PGPORT=5432
PGUSER=christmas_user
PGPASSWORD=your-password
PGDATABASE=christmas_stats_prod
```

The database must already exist. The app creates tables and hypertables automatically via migrations, but does not create the database itself. The TimescaleDB extension must be available in the target database.

## Running with Docker Compose

```bash
docker compose up -d
```

The `docker-compose.yml` mounts `greglights_config.json` read-only into the container and sources credentials from `pg.env`.

## Running with Kubernetes

See [docs/k8s-deployment.md](docs/k8s-deployment.md) for full manifests. The app runs in namespace `gjh-christmas` and requires two Secrets: one for PostgreSQL credentials (injected as env vars) and one for the greglights config (mounted as a file).

## Running Locally

```bash
cd app
npm install
# ensure PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE are set in your environment
# and greglights_config.json is present in app/
node index.js
```

## Grafana Dashboards

Pre-built Grafana dashboard JSON files are in the `dashboards/` directory:

| File                  | Shows                                          |
| --------------------- | ---------------------------------------------- |
| `power_total.json`    | Total power consumption over time              |
| `raw_amps_port.json`  | Per-circuit amperage                           |
| `fpp_temp.json`       | FPP controller temperatures                    |
| `fpp_voltage.json`    | FPP controller voltages                        |
| `fpp_uptime.json`     | FPP player uptime                              |
| `house_temp.json`     | Indoor/outdoor temperature from Shelly sensors |
| `phone_data.json`     | Visitor phone interactions                     |
| `tunnel_buttons.json` | Physical button press counts                   |

Import them via Grafana → Dashboards → Import, pointed at your TimescaleDB datasource.

## Tests

```bash
cd app
npm test
```

## Scope

This is a personal project. Feel free to use it as a starting point for your own Christmas light show monitoring setup.
