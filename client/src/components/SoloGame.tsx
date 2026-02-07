import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore, useAppStore } from '../store';
import { useCanvas } from '../hooks/useCanvas';
import { useAudio } from '../hooks/useAudio';
import { Toolbar } from './Toolbar';
import { GridOverlay } from './GridOverlay';
import { FloatingReference } from './FloatingReference';
import { Scoreboard } from './Scoreboard';
import { generateImage } from '../services/api';
import { submitSketchForScoring } from '../services/api';
import {
  ArrowLeft, Clock, Send, Loader2,
  SplitSquareVertical, PictureInPicture2,
} from 'lucide-react';
import type { Difficulty, MatchResult } from '../types';

const CANVAS_SIZE = 512;

export function SoloGame() {
  const {
    setMode, gameState, setGameState,
    soloDifficulty, setSoloDifficulty,
    soloTimer, setSoloTimer,
    soloGrid, setSoloGrid,
    referenceImageUrl, setReferenceImageUrl,
    currentTool, brushSize, brushColor, opacity,
    referenceVisible, gridVisible,
    setGridVisible,
    myResult, setMyResult,
    resetGame,
  } = useGameStore();

  const { settings, updateSettings } = useAppStore();
  const { playSfx } = useAudio(settings.audio);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { undo, redo, clearCanvas, canUndo, canRedo, getImageData } = useCanvas(canvasRef, {
    tool: currentTool,
    brushSize,
    brushColor,
    opacity,
  });

  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Setup phase
  const [phase, setPhase] = useState<'setup' | 'playing' | 'results'>('setup');

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const startGame = useCallback(async () => {
    setLoading(true);
    try {
      const image = await generateImage(soloDifficulty, undefined, customPrompt || undefined);
      setReferenceImageUrl(image.url);

      // Countdown
      setPhase('playing');
      let count = 3;
      setCountdown(count);
      const cdInterval = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(cdInterval);
          setGameState('playing');
          setTimeRemaining(soloTimer);
          setGridVisible(soloGrid !== 'none');

          // Start timer
          const endTime = Date.now() + soloTimer * 1000;
          timerRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setTimeRemaining(remaining);
            if (remaining <= 0) {
              clearInterval(timerRef.current!);
              handleSubmit();
            }
          }, 200);
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start game:', err);
    }
    setLoading(false);
  }, [soloDifficulty, soloTimer, soloGrid]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setGameState('submitted');

    if (timerRef.current) clearInterval(timerRef.current);

    const imageData = getImageData();
    playSfx('submit');

    try {
      const result = await submitSketchForScoring(imageData, referenceImageUrl, soloDifficulty);
      const matchResult: MatchResult = {
        playerId: 'solo',
        playerName: 'You',
        score: result.score,
        rank: 1,
        submissionTime: (soloTimer - timeRemaining) * 1000,
        breakdown: result.breakdown,
        heatmapUrl: result.heatmapUrl,
        comparisonUrl: result.comparisonUrl,
      };
      setMyResult(matchResult);
      playSfx('complete');
      setPhase('results');
    } catch (err) {
      console.error('Submission failed:', err);
    }
    setSubmitting(false);
  }, [submitting, getImageData, referenceImageUrl, soloDifficulty, soloTimer, timeRemaining, playSfx]);

  const handleBack = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    resetGame();
    setMode('menu');
  };

  const handleRematch = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    resetGame();
    setPhase('setup');
  };

  // ── Setup Phase ──
  if (phase === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
        <button onClick={handleBack} className="absolute top-6 left-6 btn-ghost flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="text-3xl font-bold mb-8">Solo Practice</h2>

        <div className="w-full max-w-md space-y-6">
          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setSoloDifficulty(d)}
                  className={`flex-1 py-3 rounded-apple font-medium text-sm transition-all
                    ${soloDifficulty === d
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                    }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">
              Timer: {soloTimer}s ({Math.floor(soloTimer / 60)}:{(soloTimer % 60).toString().padStart(2, '0')})
            </label>
            <input
              type="range"
              min={30}
              max={600}
              step={30}
              value={soloTimer}
              onChange={(e) => setSoloTimer(parseInt(e.target.value))}
              className="w-full accent-[#007AFF]"
            />
            <div className="flex justify-between text-xs text-[#86868B] mt-1">
              <span>30s</span>
              <span>10min</span>
            </div>
          </div>

          {/* Grid */}
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">Grid Overlay</label>
            <div className="flex flex-wrap gap-2">
              {['none', '3x3', '4x4', '6x6', '8x8'].map((g) => (
                <button
                  key={g}
                  onClick={() => setSoloGrid(g)}
                  className={`px-4 py-2 rounded-apple text-sm font-medium transition-all
                    ${soloGrid === g
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                    }`}
                >
                  {g === 'none' ? 'No Grid' : g}
                </button>
              ))}
            </div>
          </div>

          {/* Reference View Mode */}
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">Reference View</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ referenceViewMode: 'split' })}
                className={`flex-1 py-3 rounded-apple font-medium text-sm flex items-center justify-center gap-2 transition-all
                  ${settings.referenceViewMode === 'split' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
              >
                <SplitSquareVertical size={16} /> Split Pane
              </button>
              <button
                onClick={() => updateSettings({ referenceViewMode: 'floating' })}
                className={`flex-1 py-3 rounded-apple font-medium text-sm flex items-center justify-center gap-2 transition-all
                  ${settings.referenceViewMode === 'floating' ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
              >
                <PictureInPicture2 size={16} /> Floating
              </button>
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">
              Custom Prompt (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. a cat sitting on a windowsill"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-[#86868B] mt-1">
              Leave empty for a random reference based on difficulty
            </p>
          </div>

          <button
            onClick={startGame}
            disabled={loading}
            className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : null}
            {loading ? 'Generating Reference...' : 'Start Sketching'}
          </button>
        </div>
      </div>
    );
  }

  // ── Results Phase ──
  if (phase === 'results' && myResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <Scoreboard
          results={[myResult]}
          onRematch={handleRematch}
          onBackToMenu={handleBack}
        />
      </div>
    );
  }

  // ── Playing Phase ──
  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E5E5EA] bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <button onClick={handleBack} className="btn-ghost flex items-center gap-2 text-sm">
          <ArrowLeft size={16} /> Exit
        </button>

        {/* Countdown or Timer */}
        {countdown > 0 ? (
          <div className="text-4xl font-bold text-[#007AFF] animate-scale-in">
            {countdown}
          </div>
        ) : (
          <div className={`flex items-center gap-2 text-lg font-semibold
            ${timeRemaining <= 10 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}
          >
            <Clock size={18} />
            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || countdown > 0}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Submit
        </button>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex ${settings.referenceViewMode === 'split' ? 'flex-row' : ''} p-4 gap-4`}>
        {/* Reference (Split Mode) */}
        {settings.referenceViewMode === 'split' && referenceVisible && referenceImageUrl && countdown <= 0 && (
          <div className="w-1/2 flex items-center justify-center">
            <div className="card p-2">
              <p className="text-xs text-[#86868B] text-center mb-2 font-medium">Reference</p>
              <div className="relative">
                <img
                  src={referenceImageUrl}
                  alt="Reference"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, maxHeight: '60vh' }}
                />
                {gridVisible && (
                  <GridOverlay gridOption={soloGrid} width={CANVAS_SIZE} height={CANVAS_SIZE} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className={`${settings.referenceViewMode === 'split' && referenceVisible ? 'w-1/2' : 'flex-1'} flex flex-col items-center`}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`drawing-canvas border border-[#E5E5EA] shadow-apple-md bg-white max-w-full`}
              style={{ maxHeight: '60vh', aspectRatio: '1' }}
            />

            {/* Grid Overlay */}
            {gridVisible && countdown <= 0 && (
              <GridOverlay gridOption={soloGrid} width={CANVAS_SIZE} height={CANVAS_SIZE} />
            )}
          </div>

          {/* Toolbar */}
          <div className="mt-4 overflow-x-auto max-w-full">
            <Toolbar
              onUndo={undo}
              onRedo={redo}
              onClear={clearCanvas}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        </div>

        {/* Floating Reference */}
        {settings.referenceViewMode === 'floating' && referenceVisible && referenceImageUrl && countdown <= 0 && (
          <FloatingReference
            imageUrl={referenceImageUrl}
            onClose={() => useGameStore.getState().setReferenceVisible(false)}
            gridOption={gridVisible ? soloGrid : 'none'}
          />
        )}
      </div>
    </div>
  );
}
