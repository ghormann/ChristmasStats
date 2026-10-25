const { seasonStart, minutesSinceSeasonStart } = require('../lib/season');

describe('seasonStart', () => {
    it('uses last year before November 15', () => {
        expect(seasonStart(new Date('2026-10-25T17:00:00Z')).toISOString())
            .toBe('2025-11-15T05:00:00.000Z');
    });

    it('uses this year from midnight Eastern on November 15', () => {
        expect(seasonStart(new Date('2026-11-15T05:00:00Z')).toISOString())
            .toBe('2026-11-15T05:00:00.000Z');
    });

    it('still uses last year late on November 14 Eastern', () => {
        expect(seasonStart(new Date('2026-11-15T04:59:59Z')).toISOString())
            .toBe('2025-11-15T05:00:00.000Z');
    });

    it('keeps the season running into January', () => {
        expect(seasonStart(new Date('2027-01-02T03:00:00Z')).toISOString())
            .toBe('2026-11-15T05:00:00.000Z');
    });
});

describe('minutesSinceSeasonStart', () => {
    it('returns whole minutes since the season started', () => {
        expect(minutesSinceSeasonStart(new Date('2026-11-16T05:30:30Z'))).toBe(24 * 60 + 30);
    });
});
