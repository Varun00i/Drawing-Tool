// ── Shared Types ──

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GridOption = 'none' | `${number}x${number}`;
export type ReferenceSource = 'ai-generated' | 'curated';
export type ReferenceViewMode = 'split' | 'floating';
export type ComparisonMode = 'overlay' | 'side-by-side' | 'flicker';

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
  referenceImageId?: string;
  startedAt?: number;
  endsAt?: number;
  results?: MatchResult[];
  createdAt: number;
}

export interface RoomSettings {
  difficulty: Difficulty;
  referenceSource: ReferenceSource;
  gridOption: GridOption;
  timerSeconds: number;
  maxPlayers: number;
}

export type RoomState = 'lobby' | 'countdown' | 'playing' | 'scoring' | 'results';

export interface MatchResult {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  submissionTime: number;
  breakdown: ScoreBreakdown;
  heatmapUrl?: string;
  comparisonUrl?: string;
  thumbnailUrl?: string;
}

export interface ScoreBreakdown {
  contourIoU: number;
  keypointMatch: number;
  localSimilarity: number;
  composite: number;
}

export interface ScoringWeights {
  contour: number;
  keypoints: number;
  local: number;
}

export const DIFFICULTY_WEIGHTS: Record<Difficulty, ScoringWeights> = {
  easy:   { contour: 0.65, keypoints: 0.30, local: 0.05 },
  medium: { contour: 0.60, keypoints: 0.33, local: 0.07 },
  hard:   { contour: 0.55, keypoints: 0.35, local: 0.10 },
};

export interface PromptTemplate {
  difficulty: Difficulty;
  prompts: string[];
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    difficulty: 'easy',
    prompts: [
      'Pencil-style outline of a single apple on white background, minimal detail, high-contrast silhouette, 1024x1024, sketch style',
      'Simple pencil outline of a banana on white background, minimal detail, sketch style, 1024x1024',
      'Clean pencil sketch of a coffee cup silhouette on white background, minimal lines, 1024x1024',
      'Simple line drawing of a star shape on white background, high contrast, sketch style, 1024x1024',
      'Pencil outline of a simple house silhouette on white background, minimal detail, 1024x1024',
    ],
  },
  {
    difficulty: 'medium',
    prompts: [
      'Pencil sketch of an oak tree silhouette with simple branches, white background, sketch style, 1024x1024',
      'Pencil drawing of a flower pot with a sunflower, moderate detail, white background, sketch style, 1024x1024',
      'Pencil sketch of a bicycle from the side, moderate detail, white background, 1024x1024',
      'Line drawing of a small boat on water, moderate detail, sketch style, white background, 1024x1024',
      'Pencil sketch of a guitar, moderate detail, clean lines, white background, 1024x1024',
    ],
  },
  {
    difficulty: 'hard',
    prompts: [
      'Pencil portrait of a human face, neutral expression, fine line detail, grayscale, sketch style, 1024x1024',
      'Detailed pencil sketch of a sitting cat, fine fur lines, grayscale, white background, 1024x1024',
      'Pencil drawing of a detailed rose with petals and leaves, fine lines, grayscale, 1024x1024',
      'Detailed pencil sketch of a human eye with realistic shading, grayscale, 1024x1024',
      'Fine pencil portrait of a dog face with detailed fur texture, grayscale, white background, 1024x1024',
    ],
  },
];

// WebSocket Events
export interface ServerToClientEvents {
  'room:state': (room: Room) => void;
  'room:player-joined': (player: Player) => void;
  'room:player-left': (playerId: string) => void;
  'room:countdown': (seconds: number) => void;
  'room:start': (data: { referenceImageUrl: string; endsAt: number }) => void;
  'room:player-submitted': (playerId: string) => void;
  'room:results': (results: MatchResult[]) => void;
  'room:error': (message: string) => void;
  'room:full': () => void;
}

export interface ClientToServerEvents {
  'room:create': (settings: RoomSettings, playerName: string, callback: (room: Room) => void) => void;
  'room:join': (code: string, playerName: string, callback: (room: Room | null, error?: string) => void) => void;
  'room:start-match': () => void;
  'room:submit': (imageData: string, callback: (result: MatchResult) => void) => void;
  'room:leave': () => void;
  'room:rematch': () => void;
}
