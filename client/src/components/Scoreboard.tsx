import type { MatchResult, ComparisonMode } from '../types';
import { Trophy, Clock, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface ScoreboardProps {
  results: MatchResult[];
  onViewDetail?: (result: MatchResult) => void;
  onRematch?: () => void;
  onBackToMenu?: () => void;
}

export function Scoreboard({ results, onViewDetail, onRematch, onBackToMenu }: ScoreboardProps) {
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-50 border-yellow-200';
      case 2: return 'bg-gray-50 border-gray-200';
      case 3: return 'bg-orange-50 border-orange-200';
      default: return 'bg-white border-[#E5E5EA]';
    }
  };

  if (selectedResult) {
    return (
      <DetailView
        result={selectedResult}
        onBack={() => setSelectedResult(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto animate-slide-up">
      <div className="text-center mb-8">
        <Trophy size={40} className="mx-auto mb-3 text-[#FF9500]" />
        <h2 className="text-2xl font-bold">Results</h2>
        <p className="text-[#86868B] mt-1">Ranked by accuracy</p>
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <button
            key={result.playerId}
            onClick={() => setSelectedResult(result)}
            className={`w-full card flex items-center gap-4 hover:shadow-apple-md transition-all ${getRankColor(result.rank)}`}
          >
            {/* Rank */}
            <div className="text-2xl font-bold min-w-[40px] text-center">
              {getRankEmoji(result.rank)}
            </div>

            {/* Thumbnail */}
            {result.thumbnailUrl && (
              <img
                src={result.thumbnailUrl}
                alt={`${result.playerName}'s sketch`}
                className="w-12 h-12 rounded-lg object-cover border border-[#E5E5EA]"
              />
            )}

            {/* Info */}
            <div className="flex-1 text-left">
              <div className="font-semibold text-base">{result.playerName}</div>
              <div className="flex items-center gap-2 text-sm text-[#86868B]">
                <Clock size={12} />
                <span>{(result.submissionTime / 1000).toFixed(1)}s</span>
              </div>
            </div>

            {/* Score */}
            <div className="text-right">
              <div className="text-2xl font-bold text-[#007AFF]">
                {result.score.toFixed(1)}%
              </div>
            </div>

            <ChevronRight size={18} className="text-[#C7C7CC]" />
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        {onRematch && (
          <button onClick={onRematch} className="btn-primary flex-1">
            Rematch
          </button>
        )}
        {onBackToMenu && (
          <button onClick={onBackToMenu} className="btn-secondary flex-1">
            Back to Menu
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail View ──
interface DetailViewProps {
  result: MatchResult;
  onBack: () => void;
}

function DetailView({ result, onBack }: DetailViewProps) {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('side-by-side');
  const [flickerState, setFlickerState] = useState(false);
  const flickerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flicker mode: alternate between reference and sketch every 800ms
  useEffect(() => {
    if (comparisonMode === 'flicker') {
      flickerTimer.current = setInterval(() => {
        setFlickerState(prev => !prev);
      }, 800);
    } else {
      if (flickerTimer.current) {
        clearInterval(flickerTimer.current);
        flickerTimer.current = null;
      }
    }
    return () => {
      if (flickerTimer.current) clearInterval(flickerTimer.current);
    };
  }, [comparisonMode]);

  // Parse comparison URL to extract reference and sketch URLs
  // The server now returns separate base64 images for flicker mode

  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <button onClick={onBack} className="btn-ghost mb-4">
        ← Back to scoreboard
      </button>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{result.playerName}</h3>
          <div className="text-3xl font-bold text-[#007AFF]">{result.score.toFixed(1)}%</div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-[#F2F2F7] rounded-apple">
            <div className="text-sm text-[#86868B] mb-1">Edge Match</div>
            <div className="text-lg font-semibold">{result.breakdown.contourIoU.toFixed(1)}%</div>
            <div className="mt-2 h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
              <div className="h-full bg-[#34C759] rounded-full transition-all" style={{ width: `${result.breakdown.contourIoU}%` }} />
            </div>
          </div>
          <div className="text-center p-3 bg-[#F2F2F7] rounded-apple">
            <div className="text-sm text-[#86868B] mb-1">Keypoints</div>
            <div className="text-lg font-semibold">{result.breakdown.keypointMatch.toFixed(1)}%</div>
            <div className="mt-2 h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
              <div className="h-full bg-[#007AFF] rounded-full transition-all" style={{ width: `${result.breakdown.keypointMatch}%` }} />
            </div>
          </div>
          <div className="text-center p-3 bg-[#F2F2F7] rounded-apple">
            <div className="text-sm text-[#86868B] mb-1">Local Detail</div>
            <div className="text-lg font-semibold">{result.breakdown.localSimilarity.toFixed(1)}%</div>
            <div className="mt-2 h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
              <div className="h-full bg-[#FF9500] rounded-full transition-all" style={{ width: `${result.breakdown.localSimilarity}%` }} />
            </div>
          </div>
        </div>

        {/* Comparison Mode Tabs */}
        <div className="flex gap-2 mb-4">
          {(['side-by-side', 'overlay', 'flicker'] as ComparisonMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setComparisonMode(mode)}
              className={`px-4 py-2 rounded-apple text-sm font-medium transition-all
                ${comparisonMode === mode
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]'
                }`}
            >
              {mode === 'side-by-side' ? 'Side by Side' : mode === 'overlay' ? 'Overlay' : 'Flicker'}
            </button>
          ))}
        </div>

        {/* Comparison Images */}
        <div className="rounded-apple overflow-hidden border border-[#E5E5EA] bg-white">
          {comparisonMode === 'side-by-side' && result.comparisonUrl && (
            <img
              src={result.comparisonUrl}
              alt="Side by side comparison"
              className="w-full"
            />
          )}

          {comparisonMode === 'overlay' && (
            <div className="relative">
              {result.overlayUrl ? (
                <img
                  src={result.overlayUrl}
                  alt="Overlay comparison"
                  className="w-full"
                />
              ) : (
                <div className="p-8 text-center text-[#86868B]">No overlay available</div>
              )}
            </div>
          )}

          {comparisonMode === 'flicker' && (
            <div className="relative">
              {(result.referenceBase64 || result.sketchBase64) ? (
                <div className="relative">
                  <img
                    src={flickerState ? (result.sketchBase64 || '') : (result.referenceBase64 || '')}
                    alt={flickerState ? 'Your Sketch' : 'Reference'}
                    className="w-full"
                  />
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {flickerState ? 'Your Sketch' : 'Reference'}
                  </div>
                </div>
              ) : result.comparisonUrl ? (
                <div className="relative">
                  <img src={result.comparisonUrl} alt="Comparison" className="w-full" />
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    Side by side (flicker unavailable)
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-[#86868B]">No images available</div>
              )}
            </div>
          )}
        </div>

        {/* Heatmap */}
        {result.heatmapUrl && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-[#86868B] mb-2">Accuracy Heatmap</h4>
            <div className="rounded-apple overflow-hidden border border-[#E5E5EA] bg-white p-2">
              <img
                src={result.heatmapUrl}
                alt="Heatmap"
                className="w-full max-w-xs mx-auto"
              />
              <div className="flex justify-center gap-6 mt-3 text-xs text-[#86868B]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> Match
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> Missed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-yellow-400" /> Extra
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
