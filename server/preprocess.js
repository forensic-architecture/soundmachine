const fs = require("fs");
const fetch = require("node-fetch");

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

let data = JSON.parse(fs.readFileSync("./data/events.json"), "utf8")
  .filter((d) => {
    const date = new Date(d.date.start);
    return date.getUTCFullYear() >= 2010 && date.getUTCFullYear() <= 2020;
  })
  .map((d) => ({
    type: d.event.type,
    opacity: d.opacity[0],
    description: d.description,
    id: d.id,
    date: d.date.start,
    target:
      [...(d.target.association || d.target.name || [])].length > 0
        ? [...(d.target.association || d.target.name || [])][0]
        : null,
    fuzziness: d.date.fuzziness,
    time: new Date(d.date.start).getTime(),
  }));

console.log(data[0]);

const histogram = data.reduce(
  (acc, d) => ({
    ...acc,
    [d.type]: d.type in acc ? acc[d.type] + 1 : 0,
  }),
  {}
);

console.log(histogram);

fs.writeFileSync(
  "./data/histogram.json",
  JSON.stringify(histogram, null, 2),
  (err) => {
    if (err) throw err;
    console.log("Reduced data written to file");
  }
);

// sort by date (ascending)
data.sort((a, b) => new Date(a.date) - new Date(b.date));
// HARDCODED: Get rid of last event (CL identifies Circles deployments...)
data = data.slice(0, -1);

fs.writeFileSync(
  "./data/reduced.json",
  JSON.stringify(data, null, 2),
  (err) => {
    if (err) throw err;
    console.log("Reduced data written to file");
  }
);
