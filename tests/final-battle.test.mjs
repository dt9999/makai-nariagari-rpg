import assert from 'node:assert/strict';
import test from 'node:test';
import { finalBattleStatus, finalCastle } from '../app/final-battle.ts';

const castle = { x: 100, y: 100, kind: 'demon-castle', complete: true };

test('requires the demon king rank and a completed demon castle', () => {
  assert.match(
    finalBattleStatus({ x: 100, y: 100, rank: 6, heroDefeated: false }, [
      castle,
    ]).label,
    /魔王/,
  );
  assert.match(
    finalBattleStatus({ x: 100, y: 100, rank: 7, heroDefeated: false }, [])
      .label,
    /魔王城/,
  );
  assert.equal(
    finalBattleStatus({ x: 100, y: 100, rank: 7, heroDefeated: false }, [
      castle,
    ]).canStart,
    true,
  );
});

test('guides the player home and reports battle completion', () => {
  assert.match(
    finalBattleStatus({ x: 5000, y: 100, rank: 7, heroDefeated: false }, [
      castle,
    ]).label,
    /m/,
  );
  assert.match(
    finalBattleStatus(
      { x: 100, y: 100, rank: 7, heroDefeated: false },
      [castle],
      true,
    ).label,
    /決戦中/,
  );
  assert.match(
    finalBattleStatus({ x: 100, y: 100, rank: 7, heroDefeated: true }, [castle])
      .label,
    /魔界統一/,
  );
  assert.equal(finalCastle([{ ...castle, complete: false }, castle]), castle);
});
