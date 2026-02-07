export type Difficulty = 'easy' | 'medium' | 'hard';
export type GridOption = 'none' | string;
export type ReferenceSource = 'ai-generated' | 'curated';
export type ReferenceViewMode = 'split' | 'floating';
export type ComparisonMode = 'overlay' | 'side-by-side' | 'flicker';
export type RoomState = 'lobby' | 'countdown' | 'playing' | 'scoring' | 'results';
export type DrawingTool = 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'fill';

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  hasSubmitted: boolean;
  score?: number;
  submissionTime?: number;
  thumbnailUrl?: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  state: RoomState;
  referenceImageUrl?: string;
  startedAt?: number;
  endsAt?: number;
  results?: MatchResult[];
}

export interface RoomSettings {
  difficulty: Difficulty;
  referenceSource: ReferenceSource;
  gridOption: GridOption;
  timerSeconds: number;
  maxPlayers: number;
}

export interface MatchResult {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  submissionTime: number;
  breakdown: ScoreBreakdown;
  heatmapUrl?: string;
  comparisonUrl?: string;
  overlayUrl?: string;
  thumbnailUrl?: string;
}

export interface ScoreBreakdown {
  contourIoU: number;
  keypointMatch: number;
  localSimilarity: number;
  composite: number;
}

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  masterMuted: boolean;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  audioDisabled: boolean;
}

export interface AppSettings {
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  referenceViewMode: ReferenceViewMode;
  showTooltips: boolean;
  onboardingComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  audio: {
    musicVolume: 0.3,
    sfxVolume: 0.5,
    musicMuted: true,
    sfxMuted: true,
    masterMuted: false,
  },
  accessibility: {
    highContrast: false,
    reduceMotion: false,
    largeText: false,
    audioDisabled: false,
  },
  referenceViewMode: 'split',
  showTooltips: true,
  onboardingComplete: false,
};
