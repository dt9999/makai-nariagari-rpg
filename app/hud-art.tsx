'use client';

// Display the supplied text-free atlases directly, without masks or cover-ups.
const FRAMES = {
  status: [8, 47, 730, 256],
  panel: [784, 308, 654, 230],
  utility: [12, 455, 371, 135],
  nav: [946, 136, 163, 163],
  hex: [344, 831, 194, 242],
  attack: [140, 831, 206, 251],
  notice: [435, 692, 948, 135],
} as const;
const ICONS = {
  map: [35, 76, 253, 221],
  inventory: [342, 73, 223, 224],
  menu: [630, 96, 219, 190],
  guide: [885, 88, 238, 201],
  castle: [1176, 74, 233, 220],
  run: [315, 345, 242, 205],
  recruit: [623, 349, 222, 188],
  gather: [892, 338, 225, 219],
  monster: [1164, 332, 244, 230],
  attack: [614, 576, 226, 222],
  heavy: [895, 583, 227, 219],
  guard: [1182, 580, 218, 229],
  evade: [40, 825, 247, 225],
  skill: [296, 807, 284, 279],
  jump: [607, 821, 255, 258],
} as const;
export function HudArt({ kind = 'panel' }: { kind?: keyof typeof FRAMES }) {
  return (
    <svg
      className={'hud-art hud-art-' + kind}
      viewBox={FRAMES[kind].join(' ')}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <image href="/ui/obsidian-frames.png" width="1448" height="1086" />
    </svg>
  );
}
export function HudIcon({ kind }: { kind: keyof typeof ICONS }) {
  return (
    <svg
      className="hud-icon"
      viewBox={ICONS[kind].join(' ')}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <image href="/ui/obsidian-icons.png" width="1448" height="1086" />
    </svg>
  );
}
