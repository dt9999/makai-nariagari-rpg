'use client';
import { useState } from 'react';
import {
  Backpack,
  Swords,
  Shield,
  FlaskConical,
  Gem,
  Crown,
  Boxes,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  itemOf,
  inventoryView,
  ITEM_KIND_NAMES,
  RARITY_NAMES,
  RARITY_COLORS,
  BONUS_NAMES,
  type InventoryOwner,
  type ItemKind,
  type Equipment,
  type ItemBonus,
} from './items';

const icons = {
  weapon: Swords,
  armor: Shield,
  consumable: FlaskConical,
  material: Boxes,
  gem: Gem,
  relic: Crown,
};
const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S', '魔王'];
export function InventoryPanel({
  world,
  open,
  onOpenChange,
  onAction,
  message,
}: {
  world: InventoryOwner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (
    action: 'equip' | 'use' | 'discard' | 'exchange',
    id: string,
  ) => void;
  message: string;
}) {
  const [filter, setFilter] = useState<ItemKind | 'all'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const stacks = inventoryView(world).filter(
    (s) => filter === 'all' || itemOf(s.id).kind === filter,
  );
  const selectedId = stacks.find((s) => s.id === selected)?.id || stacks[0]?.id;
  const item = selectedId ? itemOf(selectedId) : null;
  const equipped = item && Object.values(world.equipment).includes(item.id);
  const slot =
    item &&
    (['weapon', 'armor', 'gem', 'relic'].includes(item.kind)
      ? (item.kind as keyof Equipment)
      : null);
  const currentId = slot ? world.equipment[slot] : null;
  const comparison = currentId ? itemOf(currentId).bonus : {};
  const blocked =
    item &&
    (item.rank > world.rank || (!!item.jobs && !item.jobs.includes(world.job)));
  const choose = (id: string) => {
    setSelected(id);
    setDiscardConfirm(false);
  };
  const act = (action: 'equip' | 'use' | 'discard' | 'exchange') => {
    if (item) onAction(action, item.id);
    setDiscardConfirm(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setDiscardConfirm(false);
        onOpenChange(value);
      }}
    >
      <DialogContent className="inventory-panel" showCloseButton={false}>
        <header className="inventory-heading">
          <div>
            <DialogTitle>
              <Backpack size={24} />
              旅の持ち物
            </DialogTitle>
            <DialogDescription>
              戦利品を比べて装備し、次の探索へ備えよう。
            </DialogDescription>
          </div>
          <DialogClose className="inventory-close" aria-label="持ち物を閉じる">
            閉じる
          </DialogClose>
        </header>
        <div className="inventory-wallet">
          <span>
            魔木 <b>{world.wood}</b>
          </span>
          <span>
            瘴気鉱 <b>{world.ore}</b>
          </span>
          <span>
            HP {Math.ceil(world.hp)} / {world.maxHp}
          </span>
        </div>
        <nav className="inventory-filters" aria-label="持ち物の分類">
          {(
            ['all', ...Object.keys(ITEM_KIND_NAMES)] as (ItemKind | 'all')[]
          ).map((kind) => (
            <button
              key={kind}
              aria-pressed={filter === kind}
              onClick={() => {
                setFilter(kind);
                setDiscardConfirm(false);
              }}
            >
              {kind === 'all' ? 'すべて' : ITEM_KIND_NAMES[kind]}
            </button>
          ))}
        </nav>
        <div className="inventory-body">
          <div className="inventory-list" aria-label="所持アイテム">
            {!stacks.length && (
              <p className="inventory-empty">
                この種類はまだ持っていない。宝箱や採集地点を探そう。
              </p>
            )}
            {stacks.map((stack) => {
              const def = itemOf(stack.id),
                Icon = icons[def.kind];
              return (
                <button
                  key={stack.id}
                  aria-pressed={selectedId === stack.id}
                  onClick={() => choose(stack.id)}
                >
                  <Icon size={25} color={RARITY_COLORS[def.rarity]} />
                  <span>
                    <b>{def.name}</b>
                    <small>
                      {ITEM_KIND_NAMES[def.kind]} · {ranks[def.rank]} /{' '}
                      {RARITY_NAMES[def.rarity]}
                      {Object.values(world.equipment).includes(stack.id)
                        ? ' · 装備中'
                        : ''}
                    </small>
                  </span>
                  <strong>×{stack.count}</strong>
                </button>
              );
            })}
          </div>
          <section className="inventory-detail" aria-label="アイテム詳細">
            {item ? (
              <>
                <span style={{ color: RARITY_COLORS[item.rarity] }}>
                  {RARITY_NAMES[item.rarity]} / {ITEM_KIND_NAMES[item.kind]} /
                  RANK {ranks[item.rank]}
                </span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                {!!slot && (
                  <p className="inventory-comparing">
                    比較：{currentId ? itemOf(currentId).name : '未装備'}
                  </p>
                )}
                <dl className="inventory-bonuses">
                  {(Object.keys(BONUS_NAMES) as (keyof ItemBonus)[])
                    .filter((key) => item.bonus[key] || comparison[key])
                    .map((key) => {
                      const value = item.bonus[key] || 0,
                        delta = value - (comparison[key] || 0);
                      return (
                        <div key={key}>
                          <dt>{BONUS_NAMES[key]}</dt>
                          <dd>
                            +{value}
                            {!!slot && (
                              <em
                                className={
                                  delta > 0
                                    ? 'positive'
                                    : delta < 0
                                      ? 'negative'
                                      : ''
                                }
                              >
                                {delta > 0 ? '+' : ''}
                                {delta}
                              </em>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                </dl>
                <p>
                  素材価値：{item.value}
                  {item.heal ? ` · HP回復 +${item.heal}` : ''}
                  {item.energy ? ` · 持久回復 +${item.energy}` : ''}
                </p>
                {!!blocked && (
                  <p className="inventory-warning">
                    {item.rank > world.rank
                      ? `装備には ${ranks[item.rank]} ランクが必要`
                      : '現在の職業では使用できない武器'}
                  </p>
                )}
                <div className="inventory-actions">
                  {!!slot && (
                    <button
                      disabled={!!blocked && !equipped}
                      onClick={() => act('equip')}
                    >
                      {equipped ? '装備を外す' : '装備する'}
                    </button>
                  )}
                  {item.kind === 'consumable' && (
                    <button onClick={() => act('use')}>1個使う</button>
                  )}
                  {['hide', 'crystal'].includes(item.id) && (
                    <button onClick={() => act('exchange')}>資材に交換</button>
                  )}
                  <button
                    className="inventory-discard"
                    onClick={() => setDiscardConfirm(true)}
                  >
                    1個破棄
                  </button>
                </div>
                {discardConfirm && (
                  <fieldset
                    className="inventory-confirm"
                    aria-label="破棄の確認"
                  >
                    <p>「{item.name}」を1個、完全に破棄しますか？</p>
                    <button onClick={() => act('discard')}>破棄を確定</button>
                    <button onClick={() => setDiscardConfirm(false)}>
                      やめる
                    </button>
                  </fieldset>
                )}
              </>
            ) : (
              <p>アイテムを選ぶと詳細を確認できます。</p>
            )}
          </section>
        </div>
        <output className="inventory-feedback">
          {message}
        </output>
      </DialogContent>
    </Dialog>
  );
}
