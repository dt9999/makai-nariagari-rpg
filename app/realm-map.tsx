'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Live spatial markers require SVG rather than an img. */
import { useState } from 'react';
import { Map as MapIcon, Flag, Navigation } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  REGIONS,
  sitesIn,
  regionAt,
  headquartersOf,
  HAZARDS,
  SITE_LABELS,
  SCALE,
  type Waypoint,
} from './world';
import type { WorldLoot } from './items';
import './realm-map.css';

type MapWorld = {
  x: number;
  y: number;
  viewYaw: number;
  discovered: string[];
  discoveredSites: string[];
  rumoredSites: string[];
  conquered: string[];
  activatedSites: string[];
  talkedSites: string[];
  waypoint: Waypoint | null;
  loot: WorldLoot[];
  bases: {
    id: number;
    x: number;
    y: number;
    name: string;
    complete: boolean;
  }[];
  nodes: { x: number; y: number; kind: string; n: number }[];
};
export function RealmMap({
  world,
  open,
  onOpenChange,
  onWaypoint,
}: {
  world: MapWorld;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWaypoint: (target: Waypoint | null) => void;
}) {
  const [selected, setSelected] = useState('');
  const current = regionAt(world.x, world.y);
  const region = REGIONS.find((r) => r.id === selected) || current;
  const sites = sitesIn(region.id),
    known = world.discovered.includes(region.id),
    lord = headquartersOf(region);
  const owns = world.conquered.includes(region.id);
  const route = [
    sites.find((s) => s.kind === 'camp')!,
    sites.find((s) => s.kind === 'quarry')!,
    sites.find((s) => s.kind === 'outpost')!,
    lord,
  ];
  const discovered = (id: string) => world.discoveredSites.includes(id);
  const path = route
    .map((p) => `${p.x - region.x},${p.y - region.y}`)
    .join(' ');
  const markers = sites.filter((s) => discovered(s.id));
  const visibleBases = world.bases.filter(
    (b) => regionAt(b.x, b.y).id === region.id,
  );
  const setTarget = (target: Waypoint) => onWaypoint(target);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="realm-map-panel" showCloseButton={false}>
        <header className="realm-map-heading">
          <div>
            <DialogTitle>
              <MapIcon />
              魔界広域図
            </DialogTitle>
            <DialogDescription>
              領土を選び、地点を目的地に設定。歩いて調べると情報が増える。
            </DialogDescription>
          </div>
          <DialogClose aria-label="地図を閉じる">閉じる</DialogClose>
        </header>
        <label className="realm-mobile-select">表示する領土
          <select value={region.id} onChange={(event) => setSelected(event.target.value)}>
            {REGIONS.map((r, i) => <option key={r.id} value={r.id}>{i + 1}. {world.discovered.includes(r.id) ? r.name : '未知の領土'}{r.id === current.id ? '（現在地）' : ''}</option>)}
          </select>
        </label>
        <nav className="realm-regions" aria-label="表示する領土">
          {REGIONS.map((r, i) => {
            const seen = world.discovered.includes(r.id),
              own = world.conquered.includes(r.id);
            return (
              <button
                key={r.id}
                aria-pressed={r.id === region.id}
                onClick={() => setSelected(r.id)}
                className={own ? 'own' : seen ? 'enemy' : 'unknown'}
              >
                <small>
                  {String(i + 1).padStart(2, '0')} ·{' '}
                  {own ? '自領' : seen ? '敵領' : '未探索'}
                </small>
                <b>{seen ? r.name : '未知の領土'}</b>
                {r.id === current.id && <span>現在地</span>}
              </button>
            );
          })}
        </nav>
        <div className="realm-map-body">
          <section className="realm-chart" aria-label="領土地図">
            <div className="realm-chart-caption">
              <b>{known ? region.name : '未探索領域'}</b>
              <span>
                {owns ? '自分の領土' : '敵の支配地'} · {markers.length} / 8 発見
              </span>
            </div>
            {/* SVG conveys spatial data; an img element cannot expose these live markers. */}
            <svg
              viewBox={`-180 -180 ${region.w + 360} ${region.h + 360}`}
              role="img"
              aria-label={`${known ? region.name : '未探索領土'}の地点、攻略経路、建築物と現在地`}
            >
              <rect
                x="0"
                y="0"
                width={region.w}
                height={region.h}
                fill={known ? region.color : '#171923'}
                stroke={owns ? '#56b999' : '#936471'}
                strokeWidth="35"
              />
              {[1, 2].map((i) => (
                <line
                  key={i}
                  x1="0"
                  x2={region.w}
                  y1={(region.h * i) / 3}
                  y2={(region.h * i) / 3}
                  stroke="#a6a0aa"
                  strokeOpacity=".2"
                  strokeWidth="18"
                  strokeDasharray="60 70"
                />
              ))}
              {known && (
                <polyline
                  points={path}
                  fill="none"
                  stroke="#c2a777"
                  strokeWidth="32"
                  strokeDasharray="80 65"
                />
              )}
              {known &&
                world.nodes
                  .filter(
                    (n) =>
                      n.n > 0 &&
                      markers.some(
                        (s) => Math.hypot(s.x - n.x, s.y - n.y) < 450,
                      ),
                  )
                  .map((n, i) => (
                    <circle
                      key={i}
                      cx={n.x - region.x}
                      cy={n.y - region.y}
                      r="32"
                      fill={n.kind === 'ore' ? '#b3a8e2' : '#6dbc8f'}
                    />
                  ))}
              {HAZARDS.filter(
                (h) => h.region === region.id && discovered(h.site),
              ).map((h) => (
                <circle
                  key={h.id}
                  cx={h.x - region.x}
                  cy={h.y - region.y}
                  r={h.radius + 45}
                  fill="#e56c58"
                  opacity=".6"
                />
              ))}
              {sites.map((s) => {
                const seen = discovered(s.id);
                return (
                  <g key={s.id} opacity={seen ? 1 : 0.48}>
                    <circle
                      cx={s.x - region.x}
                      cy={s.y - region.y}
                      r="130"
                      fill={seen ? '#e7c994' : '#434453'}
                      stroke="#e1caa8"
                      strokeWidth="22"
                    />
                    <text
                      x={s.x - region.x}
                      y={s.y - region.y + 65}
                      textAnchor="middle"
                      fontSize="200"
                      fill="#181b23"
                    >
                      {seen ? SITE_LABELS[s.kind].slice(0, 1) : '?'}
                    </text>
                  </g>
                );
              })}
              {known && (
                <g>
                  <rect
                    x={lord.x - region.x - 155}
                    y={lord.y - region.y - 155}
                    width="310"
                    height="310"
                    fill={owns ? '#58c4a4' : '#d47683'}
                    transform={`rotate(45 ${lord.x - region.x} ${lord.y - region.y})`}
                  />
                  <text
                    x={lord.x - region.x}
                    y={lord.y - region.y - 290}
                    textAnchor="middle"
                    fontSize="190"
                    fill="#ffe2c5"
                  >
                    領主本拠地
                  </text>
                </g>
              )}
              {visibleBases.map((b) => (
                <rect
                  key={b.id}
                  x={b.x - region.x - 90}
                  y={b.y - region.y - 90}
                  width="180"
                  height="180"
                  fill={b.complete ? '#52e0b2' : '#83b8e5'}
                  stroke="#ecfffa"
                  strokeWidth="25"
                />
              ))}
              {world.waypoint &&
                regionAt(world.waypoint.x, world.waypoint.y).id ===
                  region.id && (
                  <circle
                    cx={world.waypoint.x - region.x}
                    cy={world.waypoint.y - region.y}
                    r="240"
                    fill="none"
                    stroke="#fff3a8"
                    strokeWidth="35"
                  />
                )}
              {region.id === current.id && (
                <g
                  transform={`translate(${world.x - region.x} ${world.y - region.y}) rotate(${(-world.viewYaw * 180) / Math.PI})`}
                >
                  <circle
                    r="130"
                    fill="#fff"
                    stroke="#182738"
                    strokeWidth="28"
                  />
                  <path d="M 0 320 L -110 150 L 110 150 Z" fill="#fff" />
                </g>
              )}
              <text x="280" y="410" fontSize="220" fill="#eee0c8">
                北 N ↑
              </text>
            </svg>
            <p className="realm-map-legend">
              ○ 発見地点　? 未探索　◇ 本拠地　■ 建築物　赤い範囲：危険地帯
            </p>
          </section>
          <section className="realm-destinations" aria-label="目的地と探索情報">
            <h3>
              {known
                ? region.subBiomes.join(' / ')
                : 'まず領土へ足を踏み入れよう'}
            </h3>
            <p>
              推奨経路：集落で補給 → 資源確保 → 前線拠点 →
              領主本拠地。順番は自由です。
            </p>
            {sites.map((s) => {
              const seen = discovered(s.id),
                rumored = world.rumoredSites?.includes(s.id),
                opened = world.loot.some(
                  (l) =>
                    l.chest &&
                    l.claimed &&
                    Math.hypot(l.x - s.x, l.y - s.y) < 120,
                );
              const completed =
                world.activatedSites?.includes(s.id) ||
                world.talkedSites?.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    setTarget({
                      id: s.id,
                      name:
                        seen || rumored
                          ? s.name
                          : `未探索の${SITE_LABELS[s.kind]}`,
                      x: s.x,
                      y: s.y,
                    })
                  }
                  aria-pressed={world.waypoint?.id === s.id}
                >
                  <div>
                    <b>
                      {seen || rumored
                        ? s.name
                        : `未探索の${SITE_LABELS[s.kind]}`}
                    </b>
                    <span>
                      {SITE_LABELS[s.kind]} ·{' '}
                      {Math.round(
                        Math.hypot(world.x - s.x, world.y - s.y) * SCALE,
                      )}{' '}
                      m{rumored && !seen ? ' · 情報のみ' : ''}
                      {opened ? ' · 宝箱取得済' : ''}
                      {completed ? ' · 調査済' : ''}
                    </span>
                  </div>
                  <Navigation size={18} />
                  {seen && <small>{s.description}</small>}
                </button>
              );
            })}
            {known && (
              <button aria-label={`${region.landmark}を目的地に設定`} onClick={() => setTarget(lord)}>
                <div>
                  <b>
                    <Flag size={16} /> {region.landmark}
                  </b>
                  <span>
                    領主本拠地 ·{' '}
                    {Math.round(
                      Math.hypot(world.x - lord.x, world.y - lord.y) * SCALE,
                    )}{' '}
                    m
                  </span>
                </div>
              </button>
            )}
            {visibleBases.map((b) => (
              <button
                key={b.id}
                aria-label={`${b.name}を目的地に設定`}
                onClick={() =>
                  setTarget({
                    id: `base-${b.id}`,
                    name: b.name,
                    x: b.x,
                    y: b.y,
                  })
                }
              >
                <div>
                  <b>{b.name}</b>
                  <span>{b.complete ? '完成した拠点' : '建築中'}</span>
                </div>
              </button>
            ))}
          </section>
        </div>
        <footer className="realm-map-footer">
          <span>
            {world.waypoint
              ? `目的地：${world.waypoint.name}`
              : '地点を選ぶと探索画面に方向と距離を表示します。'}
          </span>
          {world.waypoint && (
            <button onClick={() => onWaypoint(null)}>目的地を解除</button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
