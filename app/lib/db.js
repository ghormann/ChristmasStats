const mysql = require("mysql"); // First you need to create a connection to the db

var pool = mysql.createPool({
  connectionLimit: 5,
  host: "database",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

pool.getConnection(function(err, connection) {
  if (err) throw err; // not connected!
  console.log("Connected to DB");
  connection.release();
});

function insertName(name, type) {
  return new Promise(function(resolve, reject) {
    pool.query(
      "INSERT INTO name (name, name_type) values (?,?)",
      [name, type],
      function(error, results, fields) {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

function insertEvent(name, argument) {
    return new Promise(function(resolve, reject) {
      pool.query(
        "INSERT INTO event (name, argument) values (?,?)",
        [name, argument],
        function(error, results, fields) {
          if (error) return reject(error);
          resolve(true);
        }
      );
    });
  }
  
function insertVote(id, source) {
    return new Promise(function(resolve, reject) {
      pool.query(
        "INSERT INTO song (songid, source) values (?,?)",
        [id, source],
        function(error, results, fields) {
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
  return new Promise(function(resolve, reject) {
    pool.query(sql, [minutes], function(error, results, fields) {
      if (error) reject(error);
      rc = [];
      results.forEach(r => {
        rc.push({
          name: r.name,
          cnt: r.CNT
        });
      });

      resolve(rc);
    });
  });
}

module.exports.insertName = insertName;
module.exports.getTopNames = getTopNames;
module.exports.insertVote = insertVote;
module.exports.insertEvent = insertEvent;
