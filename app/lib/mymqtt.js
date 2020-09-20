const mqtt = require("mqtt");
const fs = require("fs");
const db = require("./db.js");

var current_status = "Unknown";
var current_song = "Unknown";
var today_power = {
  total: 0,
  cnt: 0,
};

var handlers = [
  {
    topic: "/christmas/power/Power1",
    callback: async function (topic, message) {
      try {
        let data = JSON.parse(message.toString()); // should be array
        let sensor = 1;
        let total = 0.0;
        data.forEach(function (e) {
          total += e;
        });

        today_power.total = today_power.total + total;
        today_power.cnt = today_power.cnt + 1;
        db.insertPower(current_song, sensor, total, data);
      } catch (e) {
        console.log(e);
      }
    },
  },
  {
    topic: "/christmas/falcon/player/FPP.hormann.local/playlist_details",
    callback: async function (topic, message) {
      try {
        let data = JSON.parse(message.toString());
        current_status = data.status;
        current_song = current_status;

        if ("activePlaylists" in data) {
          data.activePlaylists.forEach(function (e) {
            current_song = e.name;
          });
        }
      } catch (e) {
        console.log(e);
      }
    },
  },
  {
    topic: "/christmas/falcon/player/FPP.hormann.local/playlist/name/status",
    callback: async function (topic, message) {
      try {
        name = message.toString();
        if (name && name.length > 0) {
          await db.insertEvent("planSong", name);
        }
      } catch (e) {
        console.log(e);
      }
    },
  },
  {
    topic: "/christmas/personsName",
    callback: function (topic, message) {
      data = JSON.parse(message.toString());
      name = message.toString();
      insertName(data.name, data.from, "Normal");
    },
  },
  {
    topic: "/christmas/personsNameFront",
    callback: function (topic, message) {
      data = JSON.parse(message.toString());
      name = message.toString();
      insertName(data.name, data.from, "Front");
    },
  },
  {
    topic: "/christmas/personsNameLow",
    callback: function (topic, message) {
      data = JSON.parse(message.toString());
      name = message.toString();
      insertName(data.name, data.from, "Low");
    },
  },
  {
    topic: "/christmas/vote/add",
    callback: async function (topic, message) {
      try {
        obj = JSON.parse(message.toString());
        console.log("Vote ", obj);
        await db.insertVote(obj.id, obj.source);
      } catch (e) {
        console.log(e);
      }
    },
  },
  {
    topic: "/christmas/nameAction",
    callback: async function (topic, message) {
      try {
        msg = message.toString();
        console.log("NameAction ", msg);
        await db.insertEvent("nameAction", msg);
      } catch (e) {
        console.log(e);
      }
    },
  },
];

function publishTodayPower() {
  let topic = "/christmas/todayPower";
  let wattSeconds = 115 * today_power.total;
  let hours = today_power.cnt / 3600;
  let kwh = wattSeconds / 3600000;
  let dollars = kwh * 0.086;
  let cnt = today_power.cnt;
  let avgWatt = kwh / hours * 1000;
  let rc = {
    hours,
    avgWatt,
    kwh,
    dollars,
    cnt
  };
  client.publish(topic, JSON.stringify(rc), {}, function (err) {
    if (err) {
      console.log("Error publishing topic: ", topic);
      console.log(err);
    }
  });
}

async function publishResults() {
  let topic = "/christmas/vote/stats";

  try {
    rc = {
      songPower_1hr: await db.getSongPower(60),
      songPower_24hr: await db.getSongPower(1440),
      totalPower_1hr: await db.getTotalPower(60),
      totalPower_24hr: await db.getTotalPower(1440),
      totalPower_year: await db.getTotalPower(288000), // 200 days
      topNames_1hr: await db.getTopNames(60),
      topNames_24hr: await db.getTopNames(1440),
      topNames_year: await db.getTopNames(288000), // 200 days
      topSongs_1hr: await db.getTopVotes(60),
      topSongs_24hr: await db.getTopVotes(1440),
      topSongs_year: await db.getTopVotes(288000), // 200 days
      topPlayedSongs_1hr: await db.getTopPlayedSongs(60),
      topPlayedSongs_24hr: await db.getTopPlayedSongs(1440),
      topPlayedSongs_year: await db.getTopPlayedSongs(288000), // 200 days
      topVoters: await db.getUniqueVoters(),
    };
    console.log("Publishing ", topic);
    client.publish(topic, JSON.stringify(rc), {}, function (err) {
      if (err) {
        console.log("Error publishing topic: ", topic);
        console.log(err);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

async function insertName(name, source, type) {
  name = name.toUpperCase();
  console.log("inserting ", name, " ", type);
  try {
    await db.insertName(name, source, type);
  } catch (e) {
    console.log(e);
  }
}

async function refreshDailyPower() {
  try {
    today_power = await db.getPowerToday();
  } catch (e) {
    console.log(e);
  }
}

function init() {
  let rawdata = fs.readFileSync("greglights_config.json");
  let config = JSON.parse(rawdata);
  //let CA = [fs.readFileSync(config["ca_file"])];

  // Publish results on Startup and every 1 minute
  setTimeout(publishResults, 5000);
  setInterval(publishResults, 60000); // every 1 minutes
  //setInterval(publishResults, 10000); // debug

  // Reload daily power on startup and every 240 minutes
  // Forces a reset when day changes
  setTimeout(refreshDailyPower, 5000);
  setInterval(refreshDailyPower, 60000 * 240); 

  // Publish Daily power every 2 seconds
  setInterval(publishTodayPower, 2000);

  let options = {
    host: config["host"],
    port: config["port"],
    username: config["username"],
    password: config["password"],
    //protocol: "mqtts",
    protocol: "mqtt",
    //ca: CA,
    clientId: "vote_" + Math.random().toString(16).substr(2, 8),
    //secureProtocol: "TLSv1_2_method",
    protocolId: "MQIsdp",
    protocolVersion: 3,
  };

  client = mqtt.connect(options);
  client.on("connect", function () {
    console.log("MQTT Connect");
    handlers.forEach(function (h) {
      client.subscribe(h.topic, function (err) {
        if (err) {
          console.log("Failed to subscribe to ", h.topic);
        }
      });
    });
  });

  client.on("message", function (topic, message) {
    let handled = false;
    handlers.forEach(function (h) {
      if (topic == h.topic) {
        h.callback(topic, message);
        handled = true;
      }
    });
    if (!handled) {
      console.log("Warning: Unabled MQTT topic: ", topic);
    }
  });
}

module.exports.init = init;
