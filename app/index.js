const Hapi = require("@hapi/hapi");
const Nes = require("@hapi/nes");
const fs = require("fs");
const mymqtt = require("./lib/mymqtt.js");
const db = require("./lib/db.js");

console.log("WARNING: Cross site scripting enabled");

const server = new Hapi.Server({
  port: process.env.port || 7655,
  routes: {
    cors: true
  }
});

mymqtt.init();

const start = async () => {
  await server.register(Nes);

  console.log("Loading routes");
  let routes = [];
  fs.readdirSync(__dirname + "/routes").forEach(file => {
    console.log("\t", file);
    routes = routes.concat(require(`./routes/${file}`));
  });
  // Add Routes
  server.route(routes);

  await server.start();
  console.log(`Server running at: ${server.info.uri}`);
};

start();
