'use client';

import type { ReactNode } from 'react';
import {
  Backpack,
  BookOpen,
  Brain,
  Castle,
  Hammer,
  Map,
  Menu,
  RefreshCcw,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { HudArt, HudIcon } from './hud-art';
import type { FinalBattleStatus } from './final-battle';

export type GameScreen =
  | 'inventory'
  | 'map'
  | 'growth'
  | 'rank'
  | 'minions'
  | 'build'
  | 'transfer'
  | 'settings'
  | 'guide';

export function GamePanel({
  title,
  className = '',
  onClose,
  children,
}: {
  title: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`game-panel ${className}`}
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

const SCREENS = [
  {
    id: 'guide',
    title: '冒険の手引き',
    description: '移動から配下・建築まで、操作をひとつずつ練習。',
    Icon: BookOpen,
  },
  {
    id: 'inventory',
    title: '持ち物・装備',
    description: '戦利品を比較して装備。薬と素材もここから。',
    Icon: Backpack,
  },
  {
    id: 'map',
    title: '世界地図',
    description: '発見した場所を調べ、次の目的地を決める。',
    Icon: Map,
  },
  {
    id: 'growth',
    title: '能力・スキル',
    description: 'スキルポイントで自分だけの戦い方へ。',
    Icon: Brain,
  },
  {
    id: 'rank',
    title: '魔族進化',
    description: '主人公の全身と、次の昇格条件を確認。',
    Icon: Shield,
  },
  {
    id: 'minions',
    title: '配下・仕事',
    description: '戦闘、建築、採集などの役割を命令。',
    Icon: Users,
  },
  {
    id: 'build',
    title: '自由建築',
    description: '建物を選び、フィールドで位置を決める。',
    Icon: Hammer,
  },
  {
    id: 'transfer',
    title: '転職の祭壇',
    description: '領土と配下は維持。別の職業を育てる。',
    Icon: RefreshCcw,
  },
  {
    id: 'settings',
    title: '設定',
    description: '画質・音・視点・タッチ配置・PCキーを調整。',
    Icon: Settings,
  },
] as const;

export function AdventureMenu({
  onClose,
  onSelect,
  onRestart,
  onRaid,
  raidStatus,
  raidReady,
  heroStatus,
  onHero,
  stats,
}: {
  onClose: () => void;
  onSelect: (screen: GameScreen) => void;
  onRestart: () => void;
  onRaid: () => void;
  raidStatus: string;
  raidReady: boolean;
  heroStatus: FinalBattleStatus;
  onHero: () => void;
  stats: {
    wood: number;
    ore: number;
    minions: number;
    lands: number;
    skillPoints: number;
  };
}) {
  return (
    <GamePanel
      title="冒険メニュー"
      className="adventure-menu"
      onClose={onClose}
    >
      <div className="panel-head">
        <div>
          <Menu />
          <b>冒険メニュー</b>
          <span>メニュー中は時間が止まります</span>
        </div>
        <button onClick={onClose} aria-label="冒険メニューを閉じる">
          戻る
        </button>
      </div>
      <div className="realm-summary">
        <span>
          魔木 <b>{stats.wood}</b>
        </span>
        <span>
          瘴気鉱 <b>{stats.ore}</b>
        </span>
        <span>
          配下 <b>{stats.minions}</b>
        </span>
        <span>
          領土 <b>{stats.lands}</b>
        </span>
        <span>
          SP <b>{stats.skillPoints}</b>
        </span>
      </div>
      <nav className="adventure-grid" aria-label="冒険の管理">
        {SCREENS.map(({ id, title, description, Icon }) => (
          <button key={id} onClick={() => onSelect(id)}>
            <Icon />
            <div>
              <b>{title}</b>
              <span>{description}</span>
            </div>
          </button>
        ))}
      </nav>
      <button
        className={`territory-challenge ${raidReady ? 'ready' : ''}`}
        onClick={onRaid}
      >
        <Castle /> 領主に挑戦 <span>{raidStatus}</span>
      </button>
      <button
        className={`hero-challenge ${heroStatus.canStart ? 'ready' : ''}`}
        onClick={onHero}
      >
        <Shield /> 勇者との最終決戦 <span>{heroStatus.label}</span>
      </button>
      <p className="menu-help">
        PC：WASDで移動、画面クリックでマウス視点、Escで解除。スマホ：左スティックで移動、右の空いている部分をスワイプして視点操作。
      </p>
      <details className="restart-section">
        <summary>最初からやり直す</summary>
        <p>
          冒険はこの端末へ自動保存されています。やり直すと、現在のレベル・領土・配下・建物・持ち物が失われます。
        </p>
        <button onClick={onRestart}>進行を消して職業選択へ戻る</button>
      </details>
    </GamePanel>
  );
}

export function AdventureHUD({
  world,
  jobName,
  rankName,
  regionName,
  owner,
  inCombat,
  onMenu,
  onMap,
  onInventory,
  onRank,
  mapKey,
  inventoryKey,
  viewYaw,
}: {
  world: {
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    lv: number;
    skillPoints: number;
    guarding: boolean;
    respawnGrace: number;
  };
  jobName: string;
  rankName: string;
  regionName: string;
  owner: string;
  inCombat: boolean;
  onMenu: () => void;
  onMap: () => void;
  onInventory: () => void;
  onRank: () => void;
  mapKey: string;
  inventoryKey: string;
  viewYaw: number;
}) {
  // The world map points north toward decreasing Y; yaw zero faces +Y.
  const heading = (((180 - (viewYaw * 180) / Math.PI) % 360) + 360) % 360;
  return (
    <>
      <div className={`adventure-vitals ${inCombat ? 'in-combat' : ''}`}>
        <HudArt kind="status" />
        <div className="identity">
          <button
            onClick={onRank}
            aria-label="魔族ランクと全身を確認"
            data-sovereign={rankName.length > 1}
          >
            {rankName}
          </button>
          <span>
            Lv.{world.lv} <b>{jobName}</b>
          </span>
          {inCombat && <em>戦闘中</em>}
          {(world.respawnGrace || 0) > 0 && (
            <em className="respawn-protection">
              撤退保護 {Math.ceil(world.respawnGrace || 0)}秒
            </em>
          )}
          {world.guarding && <em>防御</em>}
        </div>
        <div className="vital-row">
          <span>HP</span>
          <meter
            min={0}
            max={world.maxHp}
            value={Math.max(0, world.hp)}
            aria-label="生命力"
          />
          <b>
            {Math.ceil(Math.max(0, world.hp))}
            <small> / {world.maxHp}</small>
          </b>
        </div>
        <div className="vital-row stamina">
          <span>ST</span>
          <meter
            min={0}
            max={world.maxEnergy}
            value={world.energy}
            aria-label="スタミナ"
          />
          <b>
            {Math.ceil(world.energy)}
            <small> / {world.maxEnergy}</small>
          </b>
        </div>
      </div>
      <div
        className="realm-compass"
        aria-label={`方角 ${Math.round(heading)}度`}
      >
        <div className="compass-track">
          {Array.from({ length: 8 }, (_, index) => {
            const degrees = index * 45;
            const offset = ((degrees - heading + 540) % 360) - 180;
            if (Math.abs(offset) > 90) return null;
            return (
              <span
                key={index}
                className={index % 2 === 0 ? 'cardinal' : ''}
                style={{ left: `${50 + offset / 1.8}%` }}
              >
                {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][index]}
              </span>
            );
          })}
        </div>
        <b aria-hidden="true">✦</b>
      </div>
      <nav className="adventure-nav" aria-label="ゲームメニュー">
        <button onClick={onMap} aria-label="世界地図を開く">
          <HudArt kind="nav" />
          <HudIcon kind="map" />
          <span>地図</span>
          <kbd>{mapKey}</kbd>
        </button>
        <button onClick={onInventory} aria-label="持ち物を開く">
          <HudArt kind="nav" />
          <HudIcon kind="inventory" />
          <span>持ち物</span>
          <kbd>{inventoryKey}</kbd>
        </button>
        <button onClick={onMenu} aria-label="冒険メニューを開く">
          <HudArt kind="nav" />
          <HudIcon kind="menu" />
          <span>メニュー</span>
          {world.skillPoints > 0 && (
            <i aria-label="使用可能なスキルポイントあり" />
          )}
        </button>
      </nav>
      <div className={`adventure-location ${owner}`}>
        <HudArt kind="notice" />
        <HudIcon kind="castle" />
        <span>{regionName}</span>
        <b>
          {owner === 'enemy' ? '敵領土' : owner === 'own' ? '自領' : '未支配'}
        </b>
      </div>
    </>
  );
}
