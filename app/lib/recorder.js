// Decides whether a frequently-published value is worth a new row.
// A value is recorded when it differs from the last recorded value (but not
// more often than minIntervalMs), and at least once every heartbeatMs so
// flat periods still show up in Grafana.
function createRecorder({ minIntervalMs, heartbeatMs }) {
    let lastValue;
    let lastTs = -Infinity;

    return {
        shouldRecord(value, now = Date.now()) {
            const elapsed = now - lastTs;
            const changed = value !== lastValue;
            if (elapsed >= heartbeatMs || (changed && elapsed >= minIntervalMs)) {
                lastValue = value;
                lastTs = now;
                return true;
            }
            return false;
        },
    };
}

module.exports = { createRecorder };
