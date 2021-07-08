// This script was original written for use with Max/MSP
const maxApi = require("max-api");
const fs = require("fs");

const daysSinceEpoch = (m) => m / (1000 * 60 * 60 * 24);

let categories = JSON.parse(
  fs.readFileSync("./categories.json"),
  "utf8"
).filter((c) => c.audio.length > 0);

let allData = JSON.parse(fs.readFileSync("./data/reduced.json"), "utf8");
allData.forEach((d) => (d.daysElapsed = daysSinceEpoch(d.time)));

let data = allData;

maxApi.addHandler("test", () => {
  maxApi.outlet("yes nice test, good job");
});

maxApi.addHandler("data", () => {
  maxApi.outlet(data[0]);
});

maxApi.addHandler("reset", () => {
  mostRecentlyPlayed = [];
  data = allData;
  maxApi.outlet("reset");
});

maxApi.addHandler("timeUpdate", (a) => {
  // don't play more than 2 notes at once
  let notesSentOut = 0;
  while (data[0] && data[0].daysElapsed <= a) {
    maxApi.outlet("play", data[0].type, data[0].date);

    data = data.slice(1);
  }
});
