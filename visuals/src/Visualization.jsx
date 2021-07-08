import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useRef,
} from "react";
import {
  scalePoint,
  scaleTime,
  select,
  timeFormat as d3TimeFormat,
  linkVertical,
  bin,
  timeDay,
  timeMonth,
} from "d3";
import io from "socket.io-client";

const socket = io("localhost:8081");
const timeFormat = d3TimeFormat("%d/%m/%Y");

export default function Visualization() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [playedNotes, setPlayedNotes] = useState({
    channel2: [],
    channel3: [],
  });
  const eventGroups = useRef({});

  const [labels, setLabels] = useState([]);

  // keeps track of all events
  const [allReceivedEvents, setAllReceivedEvents] = useState([]);
  const [events, setEvents] = useState([]);

  const [targets, setTargets] = useState([]);
  const [timeRange, setTimeRange] = useState([new Date(), new Date()]);
  const [currentDate, setCurrentDate] = useState();

  const link = linkVertical()
    .x((d) => d.x)
    .y((d) => d.y);

  const [svgEl, setSvgEl] = useState();

  const timeScale = useMemo(() => {
    return scaleTime()
      .domain(timeRange.map((d) => new Date(d)))
      .range([50, window.innerWidth - 50]);
  }, [timeRange]);

  const xScale = useMemo(() => {
    return scalePoint()
      .domain(labels.map((l) => l.type))
      .range([100, window.innerWidth - 100]);
  });

  const binsByMonth = useMemo(() => {
    return bin()
      .domain(timeScale.domain())
      .value((d) => new Date(d.date))
      .thresholds(timeScale.ticks(timeMonth.every(1)))(allReceivedEvents);
  }, [allReceivedEvents]);

  const initSvg = useCallback((container) => {
    const svg = select(container);
    setSvgEl(svg);
  }, []);

  useEffect(() => {
    // const socket = io("localhost:8081");
    socket.on("connect", () => {
      setIsConnected(true);
      setEvents([]);
    });
    socket.on("date", (date) => {
      setCurrentDate(new Date(date));
    });
    // TODO clear all events and texts
    socket.on("restart", (date) => {
      setAllReceivedEvents((events) => []);
      setEvents((events) => []);
    });
    socket.on("data", ({ noteDict, extent }) => {
      console.log(extent);
      setTimeRange(extent);
      const labels = noteDict.reduce((acc, curr) => {
        return [
          ...acc,
          ...Object.entries(curr.children).map(([k, v]) => ({
            type: k,
            ...v,
            channel: curr.channel,
          })),
          // ...curr.children.map((c) => ({ ...c, channel: curr.channel })),
        ];
      }, []);
      eventGroups.current = labels.reduce(
        (acc, curr) => ({ ...acc, [curr.type]: [] }),
        {}
      );
      setLabels(labels);
      // console.log(a);
    });
    socket.on("noteon", ({ channel, event, playing }) => {
      setPlayedNotes((playedNotes) => ({
        ...playedNotes,
        [`channel${channel}`]: playing,
      }));

      if (event.target)
        setTargets((targets) => [
          ...new Set([event.target, ...targets.slice(0, 20)]),
        ]);
      setAllReceivedEvents((events) => [...events, event]);
      // cap to a maximum of 10 events per event type
      eventGroups.current = {
        ...eventGroups.current,
        [event.type]: [event, ...eventGroups.current[event.type]].slice(0, 10),
      };
      setEvents((events) =>
        Object.values(eventGroups.current).flatMap((e) => e)
      );
      // setEvents((events) => [event, ...events.slice(0, 50)]);
    });
    socket.on("noteoff", ({ channel, name, playing }) => {
      setPlayedNotes((playedNotes) => ({
        ...playedNotes,
        [`channel${channel}`]: playing,
      }));
    });
  }, []);

  const onMount = useCallback(
    (node) => {
      if (node !== null && !svgEl) {
        initSvg(node);
      }
    },
    [initSvg]
  );

  const tx = window.innerWidth * 0.05;
  const xM = (window.innerWidth * 0.8) / 127;
  const eventTypes = events.length > 0 ? events.map((e) => e.type) : [];

  return (
    <div className="visualization">
      <div
        className="flex flex-row col-12 full-width time relative"
        style={{ width: `100vw`, height: `50px` }}
      >
        {/* <div className="time__histogram absolute flex flex-row">
          {binsByMonth.map((b) => (
            <div
              style={{
                left: `${timeScale(new Date(b.x0))}`,
                width: `${window.innerWidth / 200}px`,
                height: `10px`,
              }}
            >
              <span
                style={{ background: `rgba(255, 255, 255, ${b.length / 100})` }}
              >
                {"/"}
              </span>
            </div>
          ))}
        </div> */}
        <div
          className="time__tracker absolute flex flex-column"
          style={{ left: `${timeScale(currentDate)}px` }}
        >
          <div
            className="center bold"
            style={{ marginLeft: `-40px`, opacity: `0.8` }}
          >
            {timeFormat(currentDate)}
          </div>
          <div className="h5" style={{ color: `red`, marginLeft: `-1px` }}>
            I
          </div>
          {/* I {timeScale(currentDate)} */}
        </div>
      </div>
      {/* <div className="h2 bold ml2 mb2">{currentDate}</div> */}
      {/* <div
        className="absolute flex flex-row overflow-hidden flex-wrap"
        style={{ overflowX: `hidden`, width: `300vw`, bottom: `300px` }}
      >
        {events.length > 0 &&
          events.map((event) => (
            <Event
              // style={{
              //   position: `absolute`,
              //   top: `500px`,
              //   left: `${xScale(event.type)}`,
              //   zIndex: 100,
              // }}
              event={event}
            />
          ))}
      </div>A */}
      <div
        className="absolute 
        flex flex-row flex-wrap
        overflow-hidden "
        style={{ overflowX: `hidden`, width: `300vw`, bottom: `10px` }}
      >
        {targets.length > 0 &&
          targets.map((name, idx) => (
            <Target
              style={{
                opacity: `${0.5}`,
                // maxWidth: `200px`,
                // left: `${idx * 200}px`,
              }}
              className="animate-left"
              key={`target-name-${name}`}
              name={name}
            />
          ))}
      </div>
      {labels.map(({ type }) => {
        const x = xScale(type);
        const filteredEvents = events.filter((e) => e.type === type);
        return filteredEvents.length === 0 ? null : (
          <div
            className="absolute overflow-hidden"
            style={{
              maxWidth: `15ch`,
              overflowY: `hidden`,
              height: `450px`,
              left: `${x - 60}px`,
              top: `450px`,
            }}
          >
            <div className="relative" style={{ width: `15ch` }}>
              {filteredEvents.map((event, idx) => (
                <Event
                  key={`${type}-event-${event.id}`}
                  className="h6 my1 fade-in absolute"
                  style={{
                    position: `absolute`,
                    top: `${idx * 50}px`,
                  }}
                  event={event}
                />
              ))}
            </div>
          </div>
        );
      })}
      <svg
        ref={onMount}
        style={{
          width: `100vw`,
          height: `100vh`,
          position: `absolute`,
          top: `0`,
          left: `0`,
        }}
      >
        {labels.map(({ type, channel, note }) => {
          const x = xScale(type);
          const y = 250;
          const playedNotesInSample = playedNotes[`channel${channel}`].filter(
            (n) => n >= note && n < note + 12
          );
          // const highlightLink = eventTypes.indexOf(type) >= 0;
          const highlightLink = playedNotesInSample.length > 0;
          return (
            <>
              <path
                d={link({
                  source: { x: timeScale(currentDate), y: 35 },
                  target: { x, y },
                })}
                fill="none"
                stroke="white"
                className={`animate-stroke-width animate-opacity`}
                strokeWidth={highlightLink ? 3 : 1}
                // strokeWidth={`${highlightLink ? 3 : 1}`}
                opacity={highlightLink ? 1 : 0.4}
              />
              <g transform={`translate(${x}, ${y})`}>
                <text
                  dy={14}
                  className={`${highlightLink && "bold"}`}
                  textAnchor={"middle"}
                  // transform={"rotate(15)"}
                  fill="white"
                  fontSize={12}
                >
                  {type}
                </text>
                {playedNotesInSample.map((d, idx) => (
                  <circle
                    // cx={tx + xM * i}
                    key={`${type}-note-circle-${d}`}
                    cx={0}
                    // cy={25 + (d - note) * 8}
                    cy={25 + idx * 8}
                    // cy={y + Math.floor(i / 12) * 20}
                    r={xM / 3}
                    className="fade-in"
                    stroke="none"
                    fill={
                      "white"
                      // playedNotes[`channel${channel}`].indexOf(note + i) >= 0
                      //   ? "white"
                      //   : "none"
                    }
                  />
                ))}
                <text
                  y={12 * 14 + 25}
                  textAnchor={"middle"}
                  // transform={"rotate(15)"}
                  fill="red"
                  className="bold"
                  fontSize={12}
                >
                  {playedNotesInSample.map((pn) => (
                    <tspan
                      className="fade-in"
                      key="key={`${type}-note-text-${pn}`}"
                    >
                      {pn}{" "}
                    </tspan>
                  ))}
                  {/* {playedNotesInSample.join("/")} */}
                </text>
              </g>
            </>
          );
        })}
      </svg>
      {/* <p>connected: {"" + 2}</p> */}
    </div>
  );
}

const Event = ({ event, style = {}, className = "" }) => (
  <div
    className={`event mx2 ${className}`}
    style={{ ...style, maxWidth: `30ch` }}
  >
    {/* <div className="bold h5 mb1">{event.date}</div> */}
    <div className="description">{event.description}</div>
  </div>
);

const Target = ({ name, style = {}, className = "" }) => (
  <div style={{ ...style }} className={`mx1 ${className}`}>
    {name}
  </div>
);
