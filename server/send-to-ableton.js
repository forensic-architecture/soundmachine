const easymidi = require("easymidi");
const fs = require("fs");
const d3 = require("d3");
const yargs = require("yargs/yargs");

// Argument parsing
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv)).argv;

const CONSTANTS = {
  DURATION: 300,
  LOOP: false,
  NOTE_DICT: "./notes.json",
  IGNORE_FUZZINESS: true,
};

if (argv.loop) {
  console.log("Looping through dataset");
  CONSTANTS.LOOP = true;
}

if (argv.fuzziness) {
  console.log("Looping through dataset");
  CONSTANTS.IGNORE_FUZZINESS = false;
}

if (argv.duration) {
  console.log(`Each loop is ${argv.duration} seconds`);
  CONSTANTS.DURATION = argv.duration;
}

if (argv.notes) {
  CONSTANTS.NOTE_DICT = argv.notes;
}

const { io } = require("./socket");
const Sampler = require("./Sampler");

const output = new easymidi.Output("EnoMIDI", true);

// Connect to first available midi port
const inputs = easymidi.getInputs();
const input = new easymidi.Input(inputs[inputs.indexOf("EnoMIDI")]);

const daysSinceEpoch = (m) => m / (1000 * 60 * 60 * 24);
const daysToEpoch = (d) => d * (1000 * 60 * 60 * 24);
// const timeFormat = d3.timeFormat("%d/%m/%Y");

input.on("clock", () => console.log("clock"));

// Load notes dictionary and construct samplers
let noteDict = JSON.parse(fs.readFileSync(CONSTANTS.NOTE_DICT), "utf8");

const samplers = noteDict.reduce((samplers, { name, channel, children }) => {
  const s = new Sampler({
    name,
    channel,
    midi: output,
    io,
  });
  s.loadSamples(children);
  samplers.push(s);
  return samplers;
}, []);

// Gracefully exit
process.on("SIGINT", () => {
  console.log(
    "Caught SIGINT. Sending websockets messages and exiting in 5 seconds."
  );

  samplers.forEach((s) => {
    s.stop();
  });

  output.close();
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

let allData = JSON.parse(fs.readFileSync("./data/reduced.json"), "utf8");

allData.forEach((d) => (d.daysElapsed = daysSinceEpoch(d.time)));
if (!CONSTANTS.IGNORE_FUZZINESS) {
  console.log("accounting for fuzziness");

  // Account for fuzziness and sort by daysElapsed (ascending)
  allData.forEach((d) => (d.daysElapsed = d.daysElapsed - d.fuzziness / 2));
}
allData.sort((a, b) => a.daysElapsed - b.daysElapsed);

let data = allData; // our queue

let [startDate, endDate] = d3.extent(allData, (d) => d.daysElapsed);
// HARDCODED for now
startDate = daysSinceEpoch(new Date(`2010-01-01`).getTime());
endDate = daysSinceEpoch(new Date(`2020-12-31`).getTime());
let currentDate = startDate;

io.on("connection", (socket) => {
  socket.emit("init", true);
  socket.emit("data", {
    noteDict,
    extent: d3.extent(allData, (d) => d.date),
  });

  socket.on("disconnect", () => {
    console.log(`disconnect: ${socket.id}`);
  });
});
io.emit("restart", true);

// SEND NOTE ON START - 125 on PHYSICAL CHANNEL
output.send("noteon", {
  note: 80,
  velocity: 127,
  channel: 2,
});

setTimeout(() => {
  output.send("noteoff", {
    note: 80,
    velocity: 127,
    channel: 2,
  });
});

const incrementEvery = (CONSTANTS.DURATION * 1000) / (endDate - startDate);
console.log(startDate, endDate, CONSTANTS.DURATION, incrementEvery);
console.log("each day is", incrementEvery, `ms`);

setInterval(() => {
  currentDate++;
  io.emit("date", new Date(daysToEpoch(currentDate)));
  while (data[0] && data[0].daysElapsed <= currentDate) {
    const { type } = data[0];

    noteDict.forEach((s, idx) => {
      if (type in s.children) {
        samplers[idx].playSample(type, {
          // pass in event information here,
          type,
          id: data[0].id,
          target: data[0].target,
          date: new Date(daysToEpoch(currentDate)),
          description: data[0].description,
        });
      }
    });

    data = data.slice(1);
  }

  if (currentDate > endDate) {
    if (CONSTANTS.LOOP) {
      currentDate = startDate;
      io.emit("restart", true);
      data = allData; // loop it
      samplers.forEach((s) => {
        s.stop();
      });
    } else {
      output.close();
      process.exit(0);
    }
  }
}, incrementEvery);
