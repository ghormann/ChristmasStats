const mysql = require("mysql"); // First you need to create a connection to the db
const moment = require("moment");

var pool = mysql.createPool({
    connectionLimit: 5,
    host: "database",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

function myQuery(sql, values, resolve) {
    let start = new Date().getTime();
    pool.query(sql, values, function (error, results, fields) {
        let duration = new Date().getTime() - start;
        if (duration > 1000) {
            console.log(sql, " took: ", new Date().getTime() - start);
        }
        resolve(error, results, fields);
    });
}

pool.getConnection(function (err, connection) {
    if (err) throw err; // not connected!
    console.log("Connected to DB");
    connection.release();
});

function getPricePerKWH() {
    return 0.12;
}

function insertPower(song, sensor, total, data) {
    return new Promise(function (resolve, reject) {
        let input = [song, sensor, total];
        data.forEach((e) => {
            input.push(e);
        });

        pool.query(
            "INSERT INTO power (song, sensor, total, s1, s2, s3, s4, s5, s6, s7, s8, s9) values (?,?,?,?,?,?,?,?,?,?,?,?)",
            input,
            function (error, results, fields) {
                if (error) return reject(error);
                resolve(true);
            }
        );
    });
}

function insertSensor(device, sensor, value, label) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO sensor (device, sensor, value, label) values (?,?,?,?)", [device, sensor, value, label], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

function insertName(name, source, type) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO name (name, source, name_type) values (?,?,?)", [name, source, type], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

function insertButton(button) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO button (button) values (?)", [button], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

function insertEvent(name, argument) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO event (name, argument) values (?,?)", [name, argument], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

function insertSnowmanVote(name, source) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO snowman_vote (snowman, source) values (?,?)", [name, source], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

function insertVote(playlist, source) {
    return new Promise(function (resolve, reject) {
        pool.query("INSERT INTO song_vote (playlist, source) values (?,?)", [playlist, source], function (error, results, fields) {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

/*
 * returns the unique number of voters across mulitple time periods
 */
function getUniquePhones() {
    all_minutes = [
        {
            minutes: 15,
            label: "15 min",
        },
        {
            minutes: 30,
            label: "30 min",
        },
        {
            minutes: 60,
            label: "1 hour",
        },
        {
            minutes: 120,
            label: "2 hours",
        },
        {
            minutes: 240,
            label: "4 hours",
        },
        {
            minutes: 1440,
            label: "1 day",
        },
        {
            minutes: 432000,
            label: "1 year",
        },
    ];

    let all = [];
    all_minutes.forEach(function (r) {
        all.push(buildUniquePhonePromise(r));
    });

    return Promise.all(all);
}

function buildUniquePhonePromise(obj) {
    let sql = "select count(distinct source) CNT from name where ts > now() - interval ? minute";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [obj.minutes], function (error, results, fields) {
            if (error) reject(error);
            else {
                obj.cnt = results[0].CNT;
                resolve(obj);
            }
        });
    });
}

/*
 * Returns promise to get names
 */
function getTopNames(minutes) {
    let sql = "select name, count(1) CNT from name where ts > now() - interval ? minute group by name order by 2 desc LIMIT 20";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    name: r.name,
                    cnt: r.CNT,
                });
            });

            resolve(rc);
        });
    });
}

/*
 * Returns promise to get names
 */
function getTopButtons(minutes) {
    let sql = "select button, count(1) CNT from button where ts > now() - interval ? minute group by button order by 2 desc LIMIT 20";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    button: r.button,
                    cnt: r.CNT,
                });
            });

            resolve(rc);
        });
    });
}

function getPowerToday() {
    let sql = "select count(1) CNT, sum(total) TOT, min(ts) MINTS from power where ts > ?;";
    let dtStr = moment().subtract(5, "hours").format("YYYY-MM-DD");
    console.log(dtStr);
    return new Promise(function (resolve, reject) {
        myQuery(sql, [dtStr], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    total: r.TOT,
                    cnt: r.CNT,
                    mints: r.MINTS,
                });
            });

            console.log("getPowerToday: ", rc[0]);
            resolve(rc[0]);
        });
    });
}

/*
 * Returns promise to return the top Played Songs
 */
function getTopPlayedSongs(minutes) {
    let sql =
        "select argument, count(1) CNT from event where name = 'planSong' and argument not in ('TuneTo','off','Intro','Good_Night', 'TheHormanns') and argument not like 'Test%' and argument not like 'Internal%' and argument not like 'Midnight%' and ts > now() - interval ? minute group by argument order by 2 desc LIMIT 20";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    name: r.argument,
                    cnt: r.CNT,
                });
            });

            resolve(rc);
        });
    });
}

/*
 * returns the unique number of voters across mulitple time periods
 */
function getUniqueVoters() {
    all_minutes = [
        {
            minutes: 15,
            label: "15 min",
        },
        {
            minutes: 30,
            label: "30 min",
        },
        {
            minutes: 60,
            label: "1 hour",
        },
        {
            minutes: 120,
            label: "2 hours",
        },
        {
            minutes: 240,
            label: "4 hours",
        },
        {
            minutes: 1440,
            label: "1 day",
        },
        {
            minutes: 432000,
            label: "1 year",
        },
    ];

    let all = [];
    all_minutes.forEach(function (r) {
        all.push(buildUniqueVoterPromise(r));
    });

    return Promise.all(all);
}

function buildUniqueVoterPromise(obj) {
    let sql = "select count(distinct source) CNT from song_vote where ts > now() - interval ? minute";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [obj.minutes], function (error, results, fields) {
            if (error) reject(error);
            else {
                obj.cnt = results[0].CNT;
                resolve(obj);
            }
        });
    });
}

function getTotalPower(minutes) {
    let sql = "select sum(total) power_total, avg(total) power_average, count(1) cnt from power where ts > now() - interval ? minute";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            if (results) {
                results.forEach((r) => {
                    let wattSeconds = 115 * r.power_total;
                    let minutes = r.cnt / 60;
                    let kwh = wattSeconds / 3600000;
                    let dollars = kwh * getPricePerKWH();
                    let avgWatt = r.power_average * 115;

                    wattSeconds = Math.round(wattSeconds * 100) / 100;
                    minutes = Math.round(minutes * 100) / 100;
                    kwh = Math.round(kwh * 100) / 100;
                    dollars = Math.round(dollars * 100) / 100;
                    avgWatt = Math.round(avgWatt * 100) / 100;

                    rc.push({
                        wattSeconds,
                        minutes,
                        kwh,
                        dollars,
                        avgWatt,
                    });
                });
            }

            resolve(rc[0]);
        });
    });
}

function getSongPower(minutes) {
    let sql =
        "select song, sum(total) power_total, avg(total) power_average, count(1) cnt from power where ts > now() - interval ? minute and song not like 'Test%' and song not like 'Internal%' and song not like 'Midnight%' group by song order by 2 desc";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                let wattSeconds = 115 * r.power_total;
                let minutes = r.cnt / 60;
                let kwh = wattSeconds / 3600000;
                let dollars = kwh * getPricePerKWH();
                let avgWatt = r.power_average * 115;

                wattSeconds = Math.round(wattSeconds * 100) / 100;
                minutes = Math.round(minutes * 100) / 100;
                kwh = Math.round(kwh * 100) / 100;
                dollars = Math.round(dollars * 100) / 100;
                avgWatt = Math.round(avgWatt * 100) / 100;

                rc.push({
                    song: r.song,
                    wattSeconds,
                    minutes,
                    kwh,
                    dollars,
                    avgWatt,
                });
            });

            resolve(rc);
        });
    });
}
/*
 * Returns promise to get votes
 */
function getTopVotes(minutes) {
    let sql = "select playlist, count(1) CNT from song_vote where ts > now() - interval ? minute group by playlist order by 2 desc LIMIT 20";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    playlist: r.playlist,
                    cnt: r.CNT,
                });
            });

            resolve(rc);
        });
    });
}

/*
 * Returns promise to get votes
 */
function getTopSnowmenVotes(minutes) {
    let sql = "select snowman, count(1) CNT from snowman_vote where ts > now() - interval ? minute group by snowman order by 2 desc LIMIT 20";
    return new Promise(function (resolve, reject) {
        myQuery(sql, [minutes], function (error, results, fields) {
            if (error) reject(error);
            rc = [];
            results.forEach((r) => {
                rc.push({
                    snowman: r.snowman,
                    cnt: r.CNT,
                });
            });

            resolve(rc);
        });
    });
}

module.exports.insertName = insertName;
module.exports.insertSnowmanVote = insertSnowmanVote;
module.exports.getTopNames = getTopNames;
module.exports.getTopVotes = getTopVotes;
module.exports.getUniqueVoters = getUniqueVoters;
module.exports.getTopPlayedSongs = getTopPlayedSongs;
module.exports.insertVote = insertVote;
module.exports.insertEvent = insertEvent;
module.exports.insertPower = insertPower;
module.exports.insertButton = insertButton;
module.exports.getSongPower = getSongPower;
module.exports.getTotalPower = getTotalPower;
module.exports.getPowerToday = getPowerToday;
module.exports.getPricePerKWH = getPricePerKWH;
module.exports.getTopSnowmenVotes = getTopSnowmenVotes;
module.exports.getTopButtons = getTopButtons;
module.exports.getUniquePhones = getUniquePhones;
module.exports.insertSensor = insertSensor;
