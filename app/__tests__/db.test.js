let db;
let mockQuery;

beforeEach(() => {
    jest.resetModules();
    mockQuery = jest.fn();
    jest.doMock('pg', () => ({
        Pool: jest.fn(() => ({ query: mockQuery })),
    }));
    db = require('../lib/db');
});

describe('connect', () => {
    it('runs SELECT 1 to verify connectivity', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.connect();
        expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });
});

describe('insertButton', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertButton('red');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO button (button) VALUES ($1)',
            ['red']
        );
    });
});

describe('insertEvent', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertEvent('planSong', 'Jingle_Bells');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO event (name, argument) VALUES ($1, $2)',
            ['planSong', 'Jingle_Bells']
        );
    });
});

describe('insertSensor', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertSensor('fpp2', 'tF', 72.5, 'temperature');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO sensor (device, sensor, value, label) VALUES ($1, $2, $3, $4)',
            ['fpp2', 'tF', 72.5, 'temperature']
        );
    });
});

describe('insertName', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertName('GREG', 'phone', 'Normal');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO name (name, source, name_type) VALUES ($1, $2, $3)',
            ['GREG', 'phone', 'Normal']
        );
    });
});

describe('insertVote', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertVote('Jingle_Bells', 'phone123');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO song_vote (playlist, source) VALUES ($1, $2)',
            ['Jingle_Bells', 'phone123']
        );
    });
});

describe('insertSnowmanVote', () => {
    it('inserts with correct SQL and params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await db.insertSnowmanVote('Frosty', 'phone123');
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO snowman_vote (snowman, source) VALUES ($1, $2)',
            ['Frosty', 'phone123']
        );
    });
});

describe('insertPower', () => {
    it('inserts with correct SQL and spread params', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const data = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9];
        await db.insertPower('Jingle_Bells', 1, 42.0, data);
        expect(mockQuery).toHaveBeenCalledWith(
            'INSERT INTO power (song, sensor, total, s1, s2, s3, s4, s5, s6, s7, s8, s9) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            ['Jingle_Bells', 1, 42.0, ...data]
        );
    });
});

describe('getTopButtons', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ button: 'red', cnt: '5' }] });
        const result = await db.getTopButtons(60);
        expect(result).toEqual([{ button: 'red', cnt: '5' }]);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('button'), [60]);
    });
});

describe('getTopNames', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ name: 'GREG', cnt: '10' }] });
        const result = await db.getTopNames(60);
        expect(result).toEqual([{ name: 'GREG', cnt: '10' }]);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('name'), [60]);
    });
});

describe('getTopVotes', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ playlist: 'Jingle_Bells', cnt: '3' }] });
        const result = await db.getTopVotes(60);
        expect(result).toEqual([{ playlist: 'Jingle_Bells', cnt: '3' }]);
    });
});

describe('getTopSnowmenVotes', () => {
    it('returns mapped results', async () => {
        mockQuery.mockResolvedValue({ rows: [{ snowman: 'Frosty', cnt: '7' }] });
        const result = await db.getTopSnowmenVotes(60);
        expect(result).toEqual([{ snowman: 'Frosty', cnt: '7' }]);
    });
});

describe('getTotalPower', () => {
    it('returns computed power fields without dollars', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ power_total: '100', power_average: '10', cnt: '360' }],
        });
        const result = await db.getTotalPower(60);
        expect(result).toHaveProperty('kwh');
        expect(result).toHaveProperty('wattSeconds');
        expect(result).toHaveProperty('minutes');
        expect(result).toHaveProperty('avgWatt');
        expect(result).not.toHaveProperty('dollars');
    });

    it('returns null when no rows', async () => {
        mockQuery.mockResolvedValue({ rows: [{ power_total: null, power_average: null, cnt: '0' }] });
        const result = await db.getTotalPower(60);
        expect(result).toBeNull();
    });
});

describe('getSongPower', () => {
    it('returns array with computed fields without dollars', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ song: 'Jingle_Bells', power_total: '50', power_average: '5', cnt: '180' }],
        });
        const result = await db.getSongPower(60);
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('song', 'Jingle_Bells');
        expect(result[0]).toHaveProperty('kwh');
        expect(result[0]).not.toHaveProperty('dollars');
    });
});

describe('getUniqueVoters', () => {
    it('returns array of time period voter counts', async () => {
        mockQuery.mockResolvedValue({ rows: [{ cnt: '5' }] });
        const result = await db.getUniqueVoters();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('cnt');
    });
});

describe('getUniquePhones', () => {
    it('returns array of time period phone counts', async () => {
        mockQuery.mockResolvedValue({ rows: [{ cnt: '3' }] });
        const result = await db.getUniquePhones();
        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('label');
        expect(result[0]).toHaveProperty('cnt');
    });
});

describe('getPowerToday', () => {
    it('returns today power summary', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ cnt: '100', tot: '500', mints: new Date() }],
        });
        const result = await db.getPowerToday();
        expect(result).toHaveProperty('total');
        expect(result).toHaveProperty('cnt');
        expect(result).toHaveProperty('mints');
    });
});
