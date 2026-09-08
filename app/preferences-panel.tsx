'use client';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_PREFERENCES,
  type GamePreferences,
  type RenderPerformance,
} from './preferences';
import './preferences.css';

function Range({
  name,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="preference-range">
      <div>
        <span>{name}</span>
        <output>{display ?? value.toFixed(2)}</output>
      </div>
      <Slider
        aria-label={name}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(value) =>
          onChange(Array.isArray(value) ? value[0] : value)
        }
      />
    </div>
  );
}

export function PreferencesPanel({
  value,
  onChange,
  performance,
}: {
  value: GamePreferences;
  onChange: (value: GamePreferences) => void;
  performance: RenderPerformance | null;
}) {
  const set = <K extends keyof GamePreferences>(
    key: K,
    v: GamePreferences[K],
  ) => onChange({ ...value, [key]: v });
  return (
    <div className="preferences-content">
      <section>
        <h3>画質</h3>
        <div className="quality-options">
          {(['low', 'medium', 'high'] as const).map((quality, i) => (
            <button
              key={quality}
              aria-pressed={value.quality === quality}
              onClick={() => set('quality', quality)}
            >
              {['低', '中', '高'][i]}
              <small>
                {
                  [
                    '軽さ優先・影なし',
                    '描画と軽さのバランス',
                    '遠景・高精細な影',
                  ][i]
                }
              </small>
            </button>
          ))}
        </div>
        <p>
          設定はすぐ反映されます。スマホでは全画質を30fps目標にし、負荷が続いた時だけ解像度を段階調整します。
        </p>
      </section>
      <section>
        <h3>視点と酔い対策</h3>
        <Range
          name="マウス感度"
          value={value.sensitivity}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(v) => set('sensitivity', v)}
        />
        <Range
          name="タッチ視点感度"
          value={value.touchSensitivity}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(v) => set('touchSensitivity', v)}
        />
        <Range
          name="視野角"
          value={value.fov}
          min={55}
          max={95}
          step={1}
          display={`${Math.round(value.fov)}°`}
          onChange={(v) => set('fov', v)}
        />
        <label className="preference-switch" htmlFor="preference-invert-y">
          <span>視点の上下を反転</span>
          <Switch
            id="preference-invert-y"
            checked={value.invertY}
            onCheckedChange={(v) => set('invertY', v)}
          />
        </label>
        <Range
          name="カメラの揺れ"
          value={value.cameraMotion}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(value.cameraMotion * 100)}%`}
          onChange={(v) => set('cameraMotion', v)}
        />
        <Range
          name="武器の動き"
          value={value.weaponMotion}
          min={0}
          max={1}
          step={0.05}
          display={`${Math.round(value.weaponMotion * 100)}%`}
          onChange={(v) => set('weaponMotion', v)}
        />
        <p>
          揺れを0%にすると歩行・被弾・攻撃時のカメラ振動を止めます。武器の動きを0%にしても、攻撃の構えと振りは判別できる範囲で残します。
        </p>
      </section>
      <section>
        <h3>タッチボタン配置</h3>
        <Range
          name="ボタンの大きさ"
          value={value.touchScale}
          min={0.95}
          max={1.15}
          step={0.05}
          display={`${Math.round(value.touchScale * 100)}%`}
          onChange={(v) => set('touchScale', v)}
        />
        <Range
          name="ボタンを上へ移動"
          value={value.touchRise}
          min={0}
          max={64}
          step={4}
          display={`${value.touchRise}px`}
          onChange={(v) => set('touchRise', v)}
        />
        <Range
          name="左右の端からの余白"
          value={value.touchInset}
          min={4}
          max={20}
          step={2}
          display={`${value.touchInset}px`}
          onChange={(v) => set('touchInset', v)}
        />
        <p>
          ゲーム画面へ戻ると配置を確認できます。左側で移動、右側の空いている部分で視点操作。
        </p>
      </section>
      <section>
        <h3>この端末での描画計測</h3>
        {performance ? (
          <div className="performance-readout">
            <b>
              {performance.fps.toFixed(1)} / {performance.targetFps} fps
            </b>
            <span>描画処理 {performance.frameMs.toFixed(1)} ms</span>
            <span>
              適応解像度 {Math.round(performance.resolutionScale * 100)}%
            </span>
            <span>
              描画命令 {performance.drawCalls} / 三角形{' '}
              {performance.triangles.toLocaleString()}
            </span>
            <span>
              GPU形状 {performance.geometries} / テクスチャ{' '}
              {performance.textures}
            </span>
          </div>
        ) : (
          <p>計測準備中…</p>
        )}
        <p>
          現在の画面での実測値です。メニュー中は戦闘処理が止まるため、戦闘中やスマホ実機の性能を保証する数値ではありません。
        </p>
      </section>
      <button
        className="binding-reset"
        onClick={() => onChange({ ...DEFAULT_PREFERENCES })}
      >
        画質・視点・配置を初期値に戻す
      </button>
    </div>
  );
}
