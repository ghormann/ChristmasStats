const { createRecorder } = require('../lib/recorder');

describe('createRecorder', () => {
    it('records the first value', () => {
        const r = createRecorder({ minIntervalMs: 0, heartbeatMs: 60000 });
        expect(r.shouldRecord('a', 1000)).toBe(true);
    });

    it('skips an unchanged value until the heartbeat', () => {
        const r = createRecorder({ minIntervalMs: 0, heartbeatMs: 60000 });
        r.shouldRecord('a', 1000);
        expect(r.shouldRecord('a', 30000)).toBe(false);
        expect(r.shouldRecord('a', 61000)).toBe(true);
    });

    it('records a changed value immediately when minInterval is 0', () => {
        const r = createRecorder({ minIntervalMs: 0, heartbeatMs: 60000 });
        r.shouldRecord('a', 1000);
        expect(r.shouldRecord('b', 1001)).toBe(true);
    });

    it('holds a changed value until minInterval has passed', () => {
        const r = createRecorder({ minIntervalMs: 15000, heartbeatMs: 60000 });
        r.shouldRecord('a', 1000);
        expect(r.shouldRecord('b', 5000)).toBe(false);
        expect(r.shouldRecord('c', 16000)).toBe(true);
    });

    it('compares against the last recorded value, not the last seen', () => {
        const r = createRecorder({ minIntervalMs: 15000, heartbeatMs: 60000 });
        r.shouldRecord('a', 1000);
        r.shouldRecord('b', 5000); // skipped
        // back to 'a' after the interval: unchanged from what was recorded
        expect(r.shouldRecord('a', 20000)).toBe(false);
    });
});
