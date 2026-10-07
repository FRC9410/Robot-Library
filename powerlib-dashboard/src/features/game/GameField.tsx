import type { GameConfig } from "./gameModel";

export function GameField({ config, pose, route, alliance, flip }: { config: GameConfig; pose?: { x: number; y: number; heading: number }; route?: number[][]; alliance?: string; flip: boolean }) {
  const { length, width, blueHub, redHub } = config.field;
  const y = (value: number) => width - value;
  const inBounds = pose && pose.x >= 0 && pose.x <= length && pose.y >= 0 && pose.y <= width;
  const hub = alliance === "Red" ? redHub : alliance === "Blue" ? blueHub : undefined;
  return <svg viewBox={`-.65 -.25 ${length + 1.3} ${width + .5}`} role="img" aria-label="2026 field, autonomous route and live robot pose" preserveAspectRatio="xMidYMid meet">
    <g transform={flip ? `translate(${length} ${width}) rotate(180)` : undefined}>
      <rect x="-.6" y="-.2" width={length + 1.2} height={width + .4} fill="#3b3d3e" />
      <rect width={length} height={width} fill="#444646" stroke="#d0d2d0" strokeWidth=".05" />
      {[blueHub, redHub].map(([x, centerY], index) => <g key={index}>
        <rect x={x - .45} y="1.25" width=".9" height={width - 2.5} fill={index ? "#d5232c" : "#242ab6"} opacity=".9" />
        <path d={`M ${x} 0 V 1.25 M ${x} ${width - 1.25} V ${width}`} stroke={index ? "#b62630" : "#453cd2"} strokeWidth=".09" />
        <rect x={x - .43} y={y(centerY) - .48} width=".86" height=".96" fill="#bbbdb9" stroke="#eeeeea" strokeWidth=".04" />
        <path d={`M ${x - .29} ${y(centerY)} l .15 -.28 h .28 l .15 .28 -.15 .28 h -.28 Z`} fill="#5e6264" stroke="#ecece3" strokeWidth=".06" />
      </g>)}
      <path d={`M ${length / 2} 0 V ${width} M 0 ${width / 2} H ${length}`} stroke="#171a1b" strokeWidth=".06" />
      {[0, length].map((x, i) => <g key={i}>
        <path d={`M ${x} .15 V 3.3 h ${i ? -.75 : .75} V 4.7 H ${x} V ${width - .15}`} fill="none" stroke="#f0efdc" strokeWidth=".05" />
        {[1.8, 6.2].map(v => <rect key={v} x={i ? length - .55 : 0} y={v - .5} width=".55" height="1" fill="none" stroke={i ? "#d44149" : "#5453c8"} strokeWidth=".08" />)}
        {[.7, width - .7].map(v => <rect key={v} x={i ? length : -.35} y={v - .35} width=".35" height=".7" fill="#c6c7c7" stroke="#ecece3" strokeWidth=".04" />)}
      </g>)}
      {[1.8, 3.4, 5, 6.6, 8.2, 9.8, 11.4, 13, 14.6, 16.2].filter(x => x < length).map(x => <g key={x}>
        <rect x={x} y="-.16" width=".5" height=".15" fill="#e4bd51" /><rect x={x} y={width + .01} width=".5" height=".15" fill="#e4bd51" />
      </g>)}
      {route && <polyline points={route.map(p => `${p[0]},${y(p[1])}`).join(" ")} fill="none" stroke="#ebd05c" strokeWidth=".045" strokeDasharray=".12 .09" />}
      {route?.map((p, i) => <circle key={i} cx={p[0]} cy={y(p[1])} r=".055" fill="#ebd05c"><title>Waypoint {i + 1}</title></circle>)}
      {inBounds && hub && <path d={`M ${pose.x} ${y(pose.y)} L ${hub[0]} ${y(hub[1])}`} stroke="#77c6ba" strokeWidth=".035" strokeDasharray=".1 .08" />}
      {inBounds && <g transform={`translate(${pose.x} ${y(pose.y)}) rotate(${-pose.heading})`}>
        <rect x="-.25" y="-.25" width=".5" height=".5" rx=".06" fill="#ffdb2d" stroke="#fff3ba" strokeWidth=".04" />
        <path d="M -.08 -.16 L .16 0 L -.08 .16" fill="none" stroke="#393b2d" strokeWidth=".09" />
      </g>}
    </g>
    {!inBounds && <text x={length / 2} y={width / 2 - .5} textAnchor="middle" fill="#fff" fontSize=".32" paintOrder="stroke" stroke="#222" strokeWidth=".06">{pose ? "Pose outside field" : "Waiting for live robot pose"}</text>}
  </svg>;
}
