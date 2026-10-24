# Name queue, name wait, SMS and website-visitor stats — design

## Why

After the season Greg wants to answer, in Grafana:

1. How big did the name queue get, and when? (plotted with live website visitors on the same graph)
2. Did the wait we quoted by text match how long the name actually took to display?
3. What are the most common names people texted that were *not* approved?

Capture only. Nothing new is added to `/christmas/vote/stats` until capture is proven.

## Non-goals

- No changes to the existing power/accuracy calculations.
- No change to the approved-name topics (`/christmas/personsName*`) — several services depend on them.
- `xlightsnamegen` is retired; only `xlights-render` changes.
- No GA replacement — the visitor count exists only so it can share a Grafana graph with the queue.

## New / newly-recorded MQTT topics

| Topic | Publisher | When | Payload |
| --- | --- | --- | --- |
| `/christmas/nameQueue` | xlights-render (existing) | every ~2s | existing `{normal:[], low:[], ready:[], status}` |
| `/christmas/scheduler/name_estimate` | fppscheduler (existing) | ~1s | existing `{estimated_seconds, message}` |
| `/christmas/sms/received` | christmasnamechecker (**new**) | every inbound SMS | see below |
| `/christmas/nameBatch` | xlights-render (**new**) | after each regular (non-midnight) batch is rendered and sent to FPP | `{ts, names:[{name, from, ts}]}` |
| `/christmas/vote/visitors` | Christmas-Vote-now (**new**) | every 15s | `{connected}` |

### `/christmas/sms/received`

```json
{
  "ts": 1734300000.123,
  "from": "+15131234567",
  "text": "Doug and Zxqv",
  "names": ["DOUG"],
  "result": "approved",
  "quoted_seconds": 240,
  "city": "CINCINNATI", "state": "OH", "zip": "45202", "country": "US"
}
```

- `result`: `approved` (sent to normal queue), `low` (valid but sender over the 15-min limit), `rejected` (no valid names), `blocked` (number blocked).
- `quoted_seconds`: the wait put in the reply text, in seconds. `null` when no number was quoted (outside display hours, low, rejected, blocked).
- `ts` is the same value placed in the approved-name messages' `ts`, so a displayed name can be matched back to its text.
- Phone number is stored as-is, consistent with the existing `name.source` column. City/state/zip are approved for storage.

### `/christmas/nameBatch`

`ts` = when the batch became READY. Each entry is the queue item as received (`name`, `from`, submit `ts`). Filler names have `from: "System"`; admin names `from: "Admin"`.

## ChristmasStats storage (migration 3)

All TimescaleDB hypertables on `ts`.

| Table | Columns | Recording rule |
| --- | --- | --- |
| `name_queue` | ts, normal_cnt, low_cnt, ready_cnt, status | on any change of the 4 values, else once per 60s |
| `name_estimate` | ts, estimated_seconds, message | on change but no more than every 15s, else once per 60s (value counts down every second) |
| `sms_received` | ts, phone, body, names (text[]), result, quoted_seconds, city, state, zip, country | every message |
| `name_batch` | ts, name, source, submitted_ts | one row per name in a batch |
| `website_visitors` | ts, connected | every message |

`ts` for `sms_received` and `name_batch` comes from the payload; others use `NOW()`.

View `name_wait`: for each non-`System` row of `name_batch`, `displayed_ts` = first `event` row with `name='planSong' AND argument='Internal_Wish_Name'` at or after the batch `ts`; `wait_seconds = displayed_ts - submitted_ts`; `quoted_seconds` joined from `sms_received` on same phone with `|ts - submitted_ts| < 2s` (all names in one text share that text's `ts` and quote; null for admin names).

## Grafana

New dashboards in `dashboards/`, Postgres datasource chosen at import (`${DS_CHRISTMAS}`):

- `name_queue.json` — normal/low/ready queue size, website visitors and total cars on one time series.
- `name_wait.json` — quoted vs actual wait per name; nightly average of each.
- `sms.json` — top non-approved names (table), texts per 15 min by result, top cities/zips.

## Builder's calls (made by Claude, not discussed)

- Throttle intervals (60s heartbeat, 15s estimate min interval, 15s visitor publish).
- Matching quoted→actual via `ts` within 2s rather than adding an ID to the existing name payload.
- "Displayed" = start of the next `Internal_Wish_Name` after the batch is ready (uses existing `event` data, no scheduler change).
- Visitor count = open websocket connections (one per open tab).
- Car count included on the queue graph.
- When the scheduler's estimate is used, `quoted_seconds` is the raw estimate even if the reply text was capped at "about 10 minutes", so the estimate itself can be tuned.
- Nightly averages use America/New_York dates.
