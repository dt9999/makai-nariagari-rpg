'use client';

import type { GamePreferences } from './preferences';

export type GameSound =
  | 'attack'
  | 'heavy'
  | 'hit'
  | 'hurt'
  | 'dodge'
  | 'step'
  | 'loot'
  | 'gather'
  | 'menu'
  | 'confirm'
  | 'magic'
  | 'recruit'
  | 'rank';

const FILES: Partial<Record<GameSound, string[]>> = {
  attack: ['/audio/weapon-swing-1.ogg', '/audio/weapon-swing-2.ogg'],
  heavy: ['/audio/heavy-impact.ogg'],
  hit: ['/audio/armor-hit.ogg'],
  hurt: ['/audio/armor-hit.ogg'],
  dodge: ['/audio/dodge.ogg'],
  step: ['/audio/footstep-1.ogg', '/audio/footstep-2.ogg'],
  loot: ['/audio/loot.ogg'],
  gather: ['/audio/heavy-impact.ogg'],
  menu: ['/audio/menu-open.ogg'],
  confirm: ['/audio/ui-confirm.ogg'],
};

const LEVELS: Record<GameSound, number> = {
  attack: 0.38,
  heavy: 0.48,
  hit: 0.34,
  hurt: 0.42,
  dodge: 0.28,
  step: 0.16,
  loot: 0.34,
  gather: 0.32,
  menu: 0.2,
  confirm: 0.24,
  magic: 0.28,
  recruit: 0.3,
  rank: 0.35,
};

class DemonAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private drone?: OscillatorNode[];
  private filter?: BiquadFilterNode;
  private settings = {
    masterVolume: 0.75,
    musicVolume: 0.45,
    sfxVolume: 0.8,
    audioMuted: false,
  };
  private scene = '';
  private combat = false;
  private variation = 0;
  private lastPlayed = new Map<GameSound, number>();

  configure(value: GamePreferences) {
    this.settings = value;
    this.applyVolume();
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.music.connect(this.master);
      this.master.connect(this.context.destination);
      this.startDrone();
      for (const files of Object.values(FILES))
        for (const src of files || []) {
          const audio = new Audio(src);
          audio.preload = 'auto';
        }
    }
    if (this.context.state === 'suspended') void this.context.resume();
    this.applyVolume();
  }

  setScene(scene: string, combat: boolean) {
    this.scene = scene;
    this.combat = combat;
    if (!this.context || !this.drone || !this.filter) return;
    const now = this.context.currentTime;
    const roots = [43.65, 46.25, 49, 51.91, 55, 58.27, 61.74, 65.41];
    let hash = 0;
    for (const char of scene) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const root = roots[Math.abs(hash) % roots.length];
    this.drone[0].frequency.setTargetAtTime(root, now, 1.8);
    this.drone[1].frequency.setTargetAtTime(
      root * (combat ? 1.505 : 1.498),
      now,
      1.8,
    );
    this.drone[2].frequency.setTargetAtTime(root * (combat ? 3 : 2), now, 1.2);
    this.filter.frequency.setTargetAtTime(combat ? 720 : 390, now, 1.5);
    this.applyVolume();
  }

  play(sound: GameSound) {
    this.unlock();
    if (this.settings.audioMuted) return;
    const now = performance.now();
    const minimumGap = sound === 'step' ? 115 : sound === 'hit' ? 55 : 20;
    if (now - (this.lastPlayed.get(sound) || 0) < minimumGap) return;
    this.lastPlayed.set(sound, now);
    const files = FILES[sound];
    if (files?.length) {
      const src = files[this.variation++ % files.length];
      const audio = new Audio(src);
      audio.volume = Math.min(
        1,
        this.settings.masterVolume * this.settings.sfxVolume * LEVELS[sound],
      );
      audio.playbackRate =
        sound === 'step'
          ? 0.88 + Math.random() * 0.16
          : 0.96 + Math.random() * 0.08;
      void audio.play().catch(() => undefined);
      return;
    }
    if (sound === 'rank') {
      [110, 164.81, 220, 329.63].forEach((frequency, index) =>
        this.tone(frequency, 1.1, 'triangle', 0.14, index * 0.12, 1.5),
      );
    } else if (sound === 'recruit') {
      this.tone(92, 0.75, 'sine', 0.15, 0, 2.4);
      this.tone(184, 0.55, 'triangle', 0.1, 0.08, 0.72);
    } else {
      this.tone(130, 0.42, 'sawtooth', 0.12, 0, 2.2);
      this.tone(390, 0.3, 'sine', 0.08, 0.06, 0.55);
    }
  }

  private startDrone() {
    if (!this.context || !this.music) return;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 390;
    filter.Q.value = 1.4;
    filter.connect(this.music);
    this.filter = filter;
    this.drone = [
      this.context.createOscillator(),
      this.context.createOscillator(),
      this.context.createOscillator(),
    ];
    const gains = [0.42, 0.2, 0.045];
    this.drone.forEach((oscillator, index) => {
      const gain = this.context!.createGain();
      oscillator.type = index === 2 ? 'sawtooth' : index ? 'triangle' : 'sine';
      oscillator.frequency.value = [49, 73.42, 98][index];
      gain.gain.value = gains[index];
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
    });
    this.setScene(this.scene || 'ruins', this.combat);
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    level: number,
    delay = 0,
    bend = 1,
  ) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(24, frequency * bend),
      start + duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(
        0.0001,
        level * this.settings.masterVolume * this.settings.sfxVolume,
      ),
      start + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private applyVolume() {
    if (!this.context || !this.master || !this.music) return;
    const now = this.context.currentTime;
    const audible = this.settings.audioMuted ? 0 : this.settings.masterVolume;
    this.master.gain.setTargetAtTime(audible, now, 0.04);
    this.music.gain.setTargetAtTime(
      this.settings.musicVolume * (this.combat ? 0.09 : 0.055),
      now,
      0.6,
    );
  }
}

const audio = new DemonAudio();
export const configureAudio = (preferences: GamePreferences) =>
  audio.configure(preferences);
export const unlockAudio = () => audio.unlock();
export const setAudioScene = (scene: string, combat: boolean) =>
  audio.setScene(scene, combat);
export const playSound = (sound: GameSound) => audio.play(sound);
