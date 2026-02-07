import { useGameStore, useAppStore } from '../store';
import { Settings, Play, Users, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface HomePageProps {
  onOpenSettings: () => void;
}

export function HomePage({ onOpenSettings }: HomePageProps) {
  const { setMode } = useGameStore();
  const { playerName, setPlayerName } = useAppStore();
  const [name, setName] = useState(playerName || '');

  const handlePlay = (mode: 'solo' | 'multiplayer') => {
    if (name.trim()) {
      setPlayerName(name.trim());
    }
    setMode(mode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 animate-fade-in">
      {/* Header */}
      <button
        onClick={onOpenSettings}
        className="absolute top-6 right-6 tool-btn text-[#86868B] hover:text-[#1D1D1F]"
        aria-label="Settings"
      >
        <Settings size={22} />
      </button>

      {/* Logo / Title */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Sparkles size={36} className="text-[#007AFF]" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Accuracy Sketch <span className="text-[#007AFF]">AI</span>
          </h1>
        </div>
        <p className="text-lg text-[#86868B] max-w-md mx-auto leading-relaxed">
          Practice solo or compete live: sketch, submit, score.
        </p>
      </div>

      {/* Name Input */}
      <div className="w-full max-w-sm mb-8">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field text-center text-lg"
          maxLength={20}
          aria-label="Player name"
        />
      </div>

      {/* Mode Selection */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button
          onClick={() => handlePlay('solo')}
          className="btn-primary flex-1 flex items-center justify-center gap-3 text-lg py-4"
        >
          <Play size={22} />
          Solo Practice
        </button>
        <button
          onClick={() => handlePlay('multiplayer')}
          className="btn-secondary flex-1 flex items-center justify-center gap-3 text-lg py-4"
        >
          <Users size={22} />
          Multiplayer
        </button>
      </div>

      {/* Tagline */}
      <p className="mt-16 text-sm text-[#86868B] text-center max-w-lg">
        Choose a reference, pick a grid, view the reference in split or floating window,
        sketch, then submit to see your accuracy. Invite up to five friends for live matches.
      </p>
    </div>
  );
}
