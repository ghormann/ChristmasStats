const mqtt = require("mqtt");
const fs = require("fs");
const db = require("./db.js");

var handlers = [
  {
    topic: "/christmas/personsName",
    callback: function(topic, message) {
      name = message.toString();
      insertName(name, "Normal");
    }
  },
  {
    topic: "/christmas/personsNameFront",
    callback: function(topic, message) {
      name = message.toString();
      insertName(name, "Front");
    }
  },
  {
    topic: "/christmas/personsNameLow",
    callback: function(topic, message) {
      name = message.toString();
      insertName(name, "Low");
    }
  },
  {
    topic: "/christmas/vote/add",
    callback: async function(topic, message) {
      try {
        obj = JSON.parse(message.toString());
        console.log("Vote ", obj);
        await db.insertVote(obj.id, obj.source);
      } catch (e) {
        console.log(e);
      }
    }
  },
  {
    topic: "/christmas/nameAction",
    callback: async function(topic, message) {
      try {
        msg = message.toString();
        console.log("NameAction ", msg);
        await db.insertEvent("nameAction", msg);
      } catch (e) {
        console.log(e);
      }
    }
  }
];

async function publishResults() {
  topic = "/christmas/vote/stats";
  try {
    rc = {
      topNames_1hr: await db.getTopNames(60),
      topNames_24hr: await db.getTopNames(1440),
      topNames_year: await db.getTopNames(525600),
      topSongs_1hr: await db.getTopSongs(60),
      topSongs_24hr: await db.getTopSongs(1440),
      topSongs_year: await db.getTopSongs(525600)
    };
    console.log("Publishing ", topic);
    client.publish(topic, JSON.stringify(rc), {}, function(err) {
      if (err) {
        console.log("Error publishing topic");
        console.log(err);
      }
    });
  } catch (e) {
    console.log(e);
  }
}

async function insertName(name, type) {
  name = name.toUpperCase();
  console.log("inserting ", name, " ", type);
  try {
    await db.insertName(name, type);
  } catch (e) {
    console.log(e);
  }
}

function init() {
  let rawdata = fs.readFileSync("greglights_config.json");
  let config = JSON.parse(rawdata);
  let CA = [fs.readFileSync(config["ca_file"])];

  setInterval(publishResults, 60000); // every 1 minutes
  //setInterval(publishResults, 10000); // debug

  let options = {
    host: config["host"],
    port: config["port"],
    username: config["username"],
    password: config["password"],
    protocol: "mqtts",
    ca: CA,
    clientId:
      "vote_" +
      Math.random()
        .toString(16)
        .substr(2, 8),
    secureProtocol: "TLSv1_2_method",
    protocolId: "MQIsdp",
    protocolVersion: 3
  };

  client = mqtt.connect(options);
  client.on("connect", function() {
    console.log("MQTT Connect");
    handlers.forEach(function(h) {
      client.subscribe(h.topic, function(err) {
        if (err) {
          console.log("Failed to subscribe to ", h.topic);
        }
      });
    });
  });

  client.on("message", function(topic, message) {
    let handled = false;
    handlers.forEach(function(h) {
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
