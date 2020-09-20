const mysql = require("mysql"); // First you need to create a connection to the db
const moment = require("moment");


var pool = mysql.createPool({
  connectionLimit: 5,
  host: "database",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

pool.getConnection(function (err, connection) {
  if (err) throw err; // not connected!
  console.log("Connected to DB");
  connection.release();
});

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

function insertName(name, source, type) {
  return new Promise(function (resolve, reject) {
    pool.query(
      "INSERT INTO name (name, source, name_type) values (?,?,?)",
      [name, source, type],
      function (error, results, fields) {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

function insertEvent(name, argument) {
  return new Promise(function (resolve, reject) {
    pool.query(
      "INSERT INTO event (name, argument) values (?,?)",
      [name, argument],
      function (error, results, fields) {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

function insertVote(id, source) {
  return new Promise(function (resolve, reject) {
    pool.query(
      "INSERT INTO song (songid, source) values (?,?)",
      [id, source],
      function (error, results, fields) {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

/*
 * Returns promise to get names
 */
function getTopNames(minutes) {
  let sql =
    "select name, count(1) CNT from name where ts > now() - interval ? minute group by name order by 2 desc LIMIT 20";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [minutes], function (error, results, fields) {
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

function getPowerToday() {
  let sql =
    "select count(1) CNT, sum(total) TOT, min(ts) MINTS from power where ts > ?;";
  let dtStr =  moment().subtract(5, 'hours').format("YYYY-MM-DD");
  console.log(dtStr);
  return new Promise(function (resolve, reject) {
    pool.query(sql, [dtStr], function (error, results, fields) {
      if (error) reject(error);
      rc = [];
      results.forEach((r) => {
        rc.push({
          total: r.TOT,
          cnt: r.CNT,
          mints: r.MINTS
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
    "select argument, count(1) CNT from event where name = 'planSong' and argument not in ('TuneTo','off','Intro','Good_Night', 'TheHormanns') and argument not like 'Test%' and argument not like 'Midnight%' and ts > now() - interval ? minute group by argument order by 2 desc LIMIT 20";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [minutes], function (error, results, fields) {
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
      minutes: 525600,
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
  let sql =
    "select count(distinct source) CNT from song where ts > now() - interval ? minute";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [obj.minutes], function (error, results, fields) {
      if (error) reject(error);
      else {
        obj.cnt = results[0].CNT;
        resolve(obj);
      }
    });
  });
}

function getTotalPower(minutes) {
  let sql =
    "select sum(total) power_total, avg(total) power_average from power where ts > now() - interval ? minute";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [minutes], function (error, results, fields) {
      if (error) reject(error);
      rc = [];
      results.forEach((r) => {
        rc.push({
          total: r.power_total,
          avg: r.power_average,
        });
      });

      resolve(rc);
    });
  });
}

function getSongPower(minutes) {
  let sql =
    "select song, sum(total) power_total, avg(total) power_average from power where ts > now() - interval ? minute group by song order by 2 desc";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [minutes], function (error, results, fields) {
      if (error) reject(error);
      rc = [];
      results.forEach((r) => {
        rc.push({
          song: r.song,
          total: r.power_total,
          avg: r.power_average,
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
  let sql =
    "select songid, count(1) CNT from song where ts > now() - interval ? minute group by songid order by 2 desc LIMIT 20";
  return new Promise(function (resolve, reject) {
    pool.query(sql, [minutes], function (error, results, fields) {
      if (error) reject(error);
      rc = [];
      results.forEach((r) => {
        rc.push({
          id: r.songid,
          cnt: r.CNT,
        });
      });

      resolve(rc);
    });
  });
}

module.exports.insertName = insertName;
module.exports.getTopNames = getTopNames;
module.exports.getTopVotes = getTopVotes;
module.exports.getUniqueVoters = getUniqueVoters;
module.exports.getTopPlayedSongs = getTopPlayedSongs;
module.exports.insertVote = insertVote;
module.exports.insertEvent = insertEvent;
module.exports.insertPower = insertPower;
module.exports.getSongPower = getSongPower;
module.exports.getTotalPower = getTotalPower;
module.exports.getPowerToday = getPowerToday;
