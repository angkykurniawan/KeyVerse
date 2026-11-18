import type { RivalDifficulty } from '../types';

export interface RankTier {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  minWpm: number;
}

export const RANK_TIERS: RankTier[] = [
  { id: 'apex', label: 'APEX LEGEND', shortLabel: 'APEX', color: '#ff2e88', glow: 'rgba(255, 46, 136, 0.45)', minWpm: 110 },
  { id: 'grandmaster', label: 'GRANDMASTER', shortLabel: 'GM', color: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)', minWpm: 90 },
  { id: 'master', label: 'MASTER', shortLabel: 'MST', color: '#ffb800', glow: 'rgba(255, 184, 0, 0.45)', minWpm: 70 },
  { id: 'pro', label: 'PRO RACER', shortLabel: 'PRO', color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.45)', minWpm: 50 },
  { id: 'challenger', label: 'CHALLENGER', shortLabel: 'CHL', color: '#00e599', glow: 'rgba(0, 229, 153, 0.4)', minWpm: 30 },
  { id: 'rookie', label: 'ROOKIE', shortLabel: 'RKI', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)', minWpm: 0 },
];

export function getRankTier(wpm: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (wpm >= tier.minWpm) return tier;
  }
  return RANK_TIERS[RANK_TIERS.length - 1];
}

export interface PaceBot {
  id: string;
  name: string;
  tag: string;
  targetWpm: number;
  color: string;
}

export interface RivalPreset {
  id: RivalDifficulty;
  label: string;
  subtitle: string;
  bots: PaceBot[];
}

export const RIVAL_PRESETS: RivalPreset[] = [
  {
    id: 'qualifier',
    label: 'Qualifier Heat',
    subtitle: 'vs Bot 35 & 50 WPM',
    bots: [
      { id: 'bot-a', name: 'NOVA-35', tag: 'PACE', targetWpm: 35, color: '#00e599' },
      { id: 'bot-b', name: 'STRIKER-50', tag: 'RIVAL', targetWpm: 50, color: '#00f0ff' },
    ],
  },
  {
    id: 'pro',
    label: 'Pro Circuit',
    subtitle: 'vs Bot 60 & 78 WPM',
    bots: [
      { id: 'bot-a', name: 'VOLT-60', tag: 'PRO', targetWpm: 60, color: '#00f0ff' },
      { id: 'bot-b', name: 'PHANTOM-78', tag: 'ELITE', targetWpm: 78, color: '#c084fc' },
    ],
  },
  {
    id: 'championship',
    label: 'Grand Final',
    subtitle: 'vs Bot 85 & 105 WPM',
    bots: [
      { id: 'bot-a', name: 'APEX-85', tag: 'MASTER', targetWpm: 85, color: '#ffb800' },
      { id: 'bot-b', name: 'HYPERION-105', tag: 'BOSS', targetWpm: 105, color: '#ff2e88' },
    ],
  },
  {
    id: 'solo',
    label: 'Solo Time Trial',
    subtitle: 'Tanpa lawan bot',
    bots: [],
  },
];

export function getRivalPreset(diff: RivalDifficulty): RivalPreset {
  return RIVAL_PRESETS.find((p) => p.id === diff) || RIVAL_PRESETS[0];
}
