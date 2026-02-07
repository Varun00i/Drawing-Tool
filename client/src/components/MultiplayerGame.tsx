import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore, useAppStore } from '../store';
import { useCanvas } from '../hooks/useCanvas';
import { useAudio } from '../hooks/useAudio';
import { socket, connectSocket, disconnectSocket } from '../services/socket';
import { Toolbar } from './Toolbar';
import { GridOverlay } from './GridOverlay';
import { FloatingReference } from './FloatingReference';
import { Scoreboard } from './Scoreboard';
import {
  ArrowLeft, Clock, Send, Loader2, Copy, Check,
  Users, Crown, Wifi, WifiOff, SplitSquareVertical, PictureInPicture2,
} from 'lucide-react';
import type { Room, RoomSettings, Difficulty, Player, MatchResult } from '../types';

const CANVAS_SIZE = 512;

export function MultiplayerGame() {
  const {
    setMode, currentTool, brushSize, brushColor, opacity,
    referenceVisible, gridVisible, setGridVisible, resetGame,
  } = useGameStore();
  const { settings, updateSettings, playerName } = useAppStore();
  const { playSfx } = useAudio(settings.audio);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { undo, redo, clearCanvas, canUndo, canRedo, getImageData } = useCanvas(canvasRef, {
    tool: currentTool,
    brushSize,
    brushColor,
    opacity,
  });

  // State
  const [phase, setPhase] = useState<'menu' | 'create' | 'join' | 'lobby' | 'playing' | 'results'>('menu');
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Room settings for creation
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [timer, setTimer] = useState(120);
  const [grid, setGrid] = useState('none');

  // Connect socket on mount
  useEffect(() => {
    connectSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('room:state', (r: Room) => {
      setRoom(r);
    });

    socket.on('room:player-joined', (player: Player) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: [...prev.players.filter(p => p.id !== player.id), player] };
      });
    });

    socket.on('room:player-left', (playerId: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.filter(p => p.id !== playerId) };
      });
    });

    socket.on('room:countdown', (sec: number) => {
      setCountdown(sec);
    });

    socket.on('room:start', (data: { referenceImageUrl: string; endsAt: number }) => {
      setReferenceImageUrl(data.referenceImageUrl);
      setPhase('playing');
      setCountdown(0);

      const endTime = data.endsAt;
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setTimeRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
        }
      }, 200);
    });

    socket.on('room:player-submitted', (playerId: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p =>
            p.id === playerId ? { ...p, hasSubmitted: true } : p
          ),
        };
      });
    });

    socket.on('room:results', (res: MatchResult[]) => {
      setResults(res);
      playSfx('complete');
      setPhase('results');
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('room:error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    });

    socket.on('room:full', () => {
      setError('Room is full (max 6 players)');
      setTimeout(() => setError(''), 4000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:countdown');
      socket.off('room:start');
      socket.off('room:player-submitted');
      socket.off('room:results');
      socket.off('room:error');
      socket.off('room:full');
      disconnectSocket();
    };
  }, [playSfx]);

  const handleBack = () => {
    socket.emit('room:leave');
    if (timerRef.current) clearInterval(timerRef.current);
    resetGame();
    setMode('menu');
  };

  const createRoom = () => {
    const roomSettings: RoomSettings = {
      difficulty,
      referenceSource: 'ai-generated',
      gridOption: grid,
      timerSeconds: timer,
      maxPlayers: 6,
    };
    socket.emit('room:create', roomSettings, playerName || 'Host', (r: Room) => {
      setRoom(r);
      setPhase('lobby');
    });
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return;
    socket.emit('room:join', joinCode.trim().toUpperCase(), playerName || 'Player',
      (r: Room | null, err?: string) => {
        if (err) {
          setError(err);
          setTimeout(() => setError(''), 4000);
          return;
        }
        if (r) {
          setRoom(r);
          setPhase('lobby');
        }
      }
    );
  };

  const startMatch = () => {
    socket.emit('room:start-match');
  };

  const handleSubmit = () => {
    if (submitting || hasSubmitted) return;
    setSubmitting(true);
    setHasSubmitted(true);

    const imageData = getImageData();
    playSfx('submit');

    socket.emit('room:submit', imageData, (_result: MatchResult) => {
      setSubmitting(false);
    });
  };

  const handleRematch = () => {
    socket.emit('room:rematch');
    setPhase('lobby');
    setHasSubmitted(false);
    setResults([]);
    setReferenceImageUrl('');
    setCountdown(0);
    setTimeRemaining(0);
  };

  const copyCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isHost = room?.hostId === socket.id;

  // ── Multiplayer Menu ──
  if (phase === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
        <button onClick={handleBack} className="absolute top-6 left-6 btn-ghost flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>

        <div className="flex items-center gap-2 mb-2 text-sm">
          {connected ? (
            <span className="flex items-center gap-1 text-[#34C759]"><Wifi size={14} /> Connected</span>
          ) : (
            <span className="flex items-center gap-1 text-[#FF3B30]"><WifiOff size={14} /> Connecting...</span>
          )}
        </div>

        <h2 className="text-3xl font-bold mb-8">Multiplayer</h2>

        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => setPhase('create')} className="btn-primary w-full text-lg py-4">
            Create Room
          </button>
          <button onClick={() => setPhase('join')} className="btn-secondary w-full text-lg py-4">
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // ── Create Room ──
  if (phase === 'create') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
        <button onClick={() => setPhase('menu')} className="absolute top-6 left-6 btn-ghost flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="text-3xl font-bold mb-8">Create Room</h2>

        <div className="w-full max-w-md space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`flex-1 py-3 rounded-apple font-medium text-sm transition-all
                    ${difficulty === d ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">
              Timer: {timer}s
            </label>
            <input type="range" min={30} max={600} step={30} value={timer}
              onChange={(e) => setTimer(parseInt(e.target.value))} className="w-full accent-[#007AFF]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#86868B] mb-2">Grid</label>
            <div className="flex flex-wrap gap-2">
              {['none', '3x3', '4x4', '6x6', '8x8'].map((g) => (
                <button key={g} onClick={() => setGrid(g)}
                  className={`px-4 py-2 rounded-apple text-sm font-medium transition-all
                    ${grid === g ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
                >
                  {g === 'none' ? 'No Grid' : g}
                </button>
              ))}
            </div>
          </div>

          <button onClick={createRoom} className="btn-primary w-full text-lg py-4">
            Create & Get Code
          </button>
        </div>
      </div>
    );
  }

  // ── Join Room ──
  if (phase === 'join') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
        <button onClick={() => setPhase('menu')} className="absolute top-6 left-6 btn-ghost flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>

        <h2 className="text-3xl font-bold mb-8">Join Room</h2>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-50 text-[#FF3B30] rounded-apple text-sm">{error}</div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="input-field text-center text-2xl tracking-[0.3em] font-mono"
            maxLength={6}
            aria-label="Room code"
          />
          <button onClick={joinRoom} disabled={joinCode.length < 4}
            className="btn-primary w-full text-lg py-4 disabled:opacity-50">
            Join
          </button>
        </div>
      </div>
    );
  }

  // ── Lobby ──
  if (phase === 'lobby' && room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
        <button onClick={handleBack} className="absolute top-6 left-6 btn-ghost flex items-center gap-2">
          <ArrowLeft size={18} /> Leave
        </button>

        <h2 className="text-2xl font-bold mb-2">Room Lobby</h2>

        {/* Room Code */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl font-mono font-bold tracking-[0.2em] text-[#007AFF]">{room.code}</span>
          <button onClick={copyCode} className="btn-ghost flex items-center gap-1 text-sm">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p className="text-sm text-[#86868B] mb-4">
          {room.settings.difficulty} • {room.settings.timerSeconds}s •
          {room.settings.gridOption === 'none' ? ' No grid' : ` ${room.settings.gridOption} grid`}
        </p>

        {/* Players */}
        <div className="card w-full max-w-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#86868B]">Players</span>
            <span className="text-sm text-[#86868B]">{room.players.length}/6</span>
          </div>
          <div className="space-y-2">
            {room.players.map((player) => (
              <div key={player.id} className="flex items-center gap-3 py-2 px-3 bg-[#F2F2F7] rounded-apple">
                <Users size={16} className="text-[#86868B]" />
                <span className="font-medium flex-1">{player.name}</span>
                {player.id === room.hostId && (
                  <Crown size={14} className="text-[#FF9500]" />
                )}
                <span className={`w-2 h-2 rounded-full ${player.connected ? 'bg-[#34C759]' : 'bg-[#C7C7CC]'}`} />
              </div>
            ))}
          </div>
        </div>

        {countdown > 0 && (
          <div className="text-6xl font-bold text-[#007AFF] animate-scale-in mb-4">{countdown}</div>
        )}

        {isHost && countdown === 0 && (
          <button onClick={startMatch} disabled={room.players.length < 1}
            className="btn-primary text-lg py-4 px-12">
            Start Match
          </button>
        )}

        {!isHost && countdown === 0 && (
          <p className="text-[#86868B]">Waiting for host to start...</p>
        )}
      </div>
    );
  }

  // ── Results ──
  if (phase === 'results') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
        <Scoreboard
          results={results}
          onRematch={isHost ? handleRematch : undefined}
          onBackToMenu={handleBack}
        />
      </div>
    );
  }

  // ── Playing ──
  return (
    <div className="min-h-screen flex flex-col animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#E5E5EA] bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <button onClick={handleBack} className="btn-ghost flex items-center gap-2 text-sm">
          <ArrowLeft size={16} /> Exit
        </button>

        {/* Timer */}
        <div className={`flex items-center gap-2 text-lg font-semibold
          ${timeRemaining <= 10 ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}
        >
          <Clock size={18} />
          {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
        </div>

        {/* Player status */}
        <div className="flex items-center gap-2">
          {room?.players.map((p) => (
            <div
              key={p.id}
              className={`w-3 h-3 rounded-full transition-colors ${p.hasSubmitted ? 'bg-[#34C759]' : 'bg-[#C7C7CC]'}`}
              title={`${p.name}: ${p.hasSubmitted ? 'submitted' : 'drawing'}`}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || hasSubmitted}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {hasSubmitted ? 'Submitted' : 'Submit'}
        </button>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex ${settings.referenceViewMode === 'split' ? 'flex-row' : ''} p-4 gap-4`}>
        {/* Reference Split */}
        {settings.referenceViewMode === 'split' && referenceVisible && referenceImageUrl && (
          <div className="w-1/2 flex items-center justify-center">
            <div className="card p-2">
              <p className="text-xs text-[#86868B] text-center mb-2 font-medium">Reference</p>
              <div className="relative">
                <img src={referenceImageUrl} alt="Reference"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, maxHeight: '60vh' }} />
                {gridVisible && room?.settings.gridOption !== 'none' && (
                  <GridOverlay gridOption={room?.settings.gridOption || 'none'} width={CANVAS_SIZE} height={CANVAS_SIZE} />
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
            {gridVisible && room?.settings.gridOption !== 'none' && (
              <GridOverlay gridOption={room?.settings.gridOption || 'none'} width={CANVAS_SIZE} height={CANVAS_SIZE} />
            )}
          </div>

          <div className="mt-4 overflow-x-auto max-w-full">
            <Toolbar onUndo={undo} onRedo={redo} onClear={clearCanvas} canUndo={canUndo} canRedo={canRedo} />
          </div>
        </div>

        {/* Floating Reference */}
        {settings.referenceViewMode === 'floating' && referenceVisible && referenceImageUrl && (
          <FloatingReference
            imageUrl={referenceImageUrl}
            onClose={() => useGameStore.getState().setReferenceVisible(false)}
            gridOption={gridVisible && room?.settings.gridOption !== 'none' ? room?.settings.gridOption : 'none'}
          />
        )}
      </div>
    </div>
  );
}
