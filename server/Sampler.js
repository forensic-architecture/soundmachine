const minorScaleFromRootNote = (note) =>
  [0, 3, 7, 10, 2, 5].map((n) => note + n);

class Sampler {
  constructor({ name = "", channel = 0, midi = null, io = null }) {
    this.name = name;
    this.channel = channel;
    this.midi = midi;
    this.samples = {};
    this.io = io;
    this.maxDuration = 6000; // of samples (ms)
  }

  loadSamples(samples = {}) {
    for (let [name, { note: root, duration }] of Object.entries(samples)) {
      this.samples[name] = new Sample({
        name,
        root,
        channel: this.channel,
        midi: this.midi,
        io: this.io,
        maxDuration: duration || this.maxDuration,
        onNoteOff: () => {
          this.io.emit("noteoff", {
            // note,
            name: name,
            channel: this.channel,
            playing: [
              ...Object.values(this.samples).flatMap((s) => [
                ...s.playing.values(),
              ]),
            ],
          });
        },
      });
    }
  }

  playSample(name = "", event = {}) {
    if (this.samples[name]) {
      this.samples[name].play();
      this.io.emit("noteon", {
        channel: this.channel,
        event,
        playing: [
          ...Object.values(this.samples).flatMap((s) => [
            ...s.playing.values(),
          ]),
        ],
      });
    } else {
      console.log(`Sample not found in Sampler ${name}`);
    }
  }

  stop() {
    Object.values(this.samples).forEach((s) => {
      // stop all soundbanks
      s.stop();
    });

    // send a message that this sampler has no soundbanks playing
    this.io.emit("noteoff", {
      channel: this.channel,
      playing: [],
    });
  }
}

class Sample {
  constructor({
    name = "",
    root = 0,
    channel = 0,
    midi,
    maxDuration = 6000,
    io = null,
    onNoteOff = () => {},
  }) {
    // super();
    (this.name = name), (this.notes = minorScaleFromRootNote(root));
    this.playing = new Set();
    this.channel = channel;
    this.midi = midi;
    this.maxDuration = maxDuration;
    this.io = io;
    this.onNoteOff = onNoteOff;
    // console.log("sampler", name, maxDuration);
  }

  stopNote(note) {
    this.playing.delete(note);
    this.midi.send("noteoff", {
      note,
      velocity: 127,
      channel: this.channel,
    });
  }

  play() {
    // pick a note which is not playing
    for (let note of this.notes) {
      if (this.playing.has(note)) continue;

      this.playing.add(note);
      const velocity = Math.floor(Math.random() * 63 + 64);
      this.midi.send("noteon", {
        note,
        velocity,
        channel: this.channel,
      });
      setTimeout(() => {
        this.playing.delete(note);
        this.onNoteOff(note);

        this.midi.send("noteoff", {
          note,
          velocity: 127,
          channel: this.channel,
        });
      }, this.maxDuration + (Math.random() * this.maxDuration) / 6);
      break; // if note found and added to queue  break
    }
  }

  stop() {
    this.notes.forEach((note) => {
      this.stopNote(note);
    });
  }
}

module.exports = Sampler;
