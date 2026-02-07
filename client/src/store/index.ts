import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppSettings, Room, MatchResult, DrawingTool,
  Difficulty, RoomState, Player,
} from '../types';
import { DEFAULT_SETTINGS } from '../types';

// ── App/Settings Store ──
interface AppStore {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  updateAudio: (partial: Partial<AppSettings['audio']>) => void;
  updateAccessibility: (partial: Partial<AppSettings['accessibility']>) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      playerName: '',
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      updateAudio: (partial) =>
        set((s) => ({ settings: { ...s.settings, audio: { ...s.settings.audio, ...partial } } })),
      updateAccessibility: (partial) =>
        set((s) => ({ settings: { ...s.settings, accessibility: { ...s.settings.accessibility, ...partial } } })),
      setPlayerName: (name) => set({ playerName: name }),
    }),
    { name: 'accuracy-sketch-settings' }
  )
);

// ── Game Store ──
interface GameStore {
  // Current game state
  mode: 'menu' | 'solo' | 'multiplayer';
  setMode: (mode: 'menu' | 'solo' | 'multiplayer') => void;

  // Room (multiplayer)
  room: Room | null;
  setRoom: (room: Room | null) => void;

  // Solo settings
  soloDifficulty: Difficulty;
  setSoloDifficulty: (d: Difficulty) => void;
  soloTimer: number;
  setSoloTimer: (t: number) => void;
  soloGrid: string;
  setSoloGrid: (g: string) => void;

  // Game state
  gameState: 'idle' | 'countdown' | 'playing' | 'submitted' | 'results';
  setGameState: (s: GameStore['gameState']) => void;
  referenceImageUrl: string;
  setReferenceImageUrl: (url: string) => void;
  countdown: number;
  setCountdown: (n: number) => void;
  timeRemaining: number;
  setTimeRemaining: (t: number) => void;
  endsAt: number;
  setEndsAt: (t: number) => void;

  // Results
  results: MatchResult[];
  setResults: (r: MatchResult[]) => void;
  myResult: MatchResult | null;
  setMyResult: (r: MatchResult | null) => void;

  // Drawing
  currentTool: DrawingTool;
  setCurrentTool: (t: DrawingTool) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  brushColor: string;
  setBrushColor: (c: string) => void;
  opacity: number;
  setOpacity: (o: number) => void;

  // Flags
  referenceVisible: boolean;
  setReferenceVisible: (v: boolean) => void;
  gridVisible: boolean;
  setGridVisible: (v: boolean) => void;

  // Reset
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  mode: 'menu',
  setMode: (mode) => set({ mode }),

  room: null,
  setRoom: (room) => set({ room }),

  soloDifficulty: 'easy',
  setSoloDifficulty: (d) => set({ soloDifficulty: d }),
  soloTimer: 120,
  setSoloTimer: (t) => set({ soloTimer: t }),
  soloGrid: 'none',
  setSoloGrid: (g) => set({ soloGrid: g }),

  gameState: 'idle',
  setGameState: (s) => set({ gameState: s }),
  referenceImageUrl: '',
  setReferenceImageUrl: (url) => set({ referenceImageUrl: url }),
  countdown: 0,
  setCountdown: (n) => set({ countdown: n }),
  timeRemaining: 0,
  setTimeRemaining: (t) => set({ timeRemaining: t }),
  endsAt: 0,
  setEndsAt: (t) => set({ endsAt: t }),

  results: [],
  setResults: (r) => set({ results: r }),
  myResult: null,
  setMyResult: (r) => set({ myResult: r }),

  currentTool: 'pencil',
  setCurrentTool: (t) => set({ currentTool: t }),
  brushSize: 3,
  setBrushSize: (s) => set({ brushSize: s }),
  brushColor: '#1E1E1E',
  setBrushColor: (c) => set({ brushColor: c }),
  opacity: 1,
  setOpacity: (o) => set({ opacity: o }),

  referenceVisible: true,
  setReferenceVisible: (v) => set({ referenceVisible: v }),
  gridVisible: false,
  setGridVisible: (v) => set({ gridVisible: v }),

  resetGame: () =>
    set({
      gameState: 'idle',
      referenceImageUrl: '',
      countdown: 0,
      timeRemaining: 0,
      endsAt: 0,
      results: [],
      myResult: null,
      currentTool: 'pencil',
      brushSize: 3,
      brushColor: '#1E1E1E',
      opacity: 1,
      referenceVisible: true,
    }),
}));
