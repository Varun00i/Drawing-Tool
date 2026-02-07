import { useEffect } from 'react';
import { useAppStore, useGameStore } from './store';
import { HomePage } from './components/HomePage';
import { SoloGame } from './components/SoloGame';
import { MultiplayerGame } from './components/MultiplayerGame';
import { SettingsPanel } from './components/SettingsPanel';
import { Onboarding } from './components/Onboarding';
import { AudioController } from './components/AudioController';
import { useState } from 'react';

export default function App() {
  const { settings } = useAppStore();
  const { mode } = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Apply accessibility classes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('high-contrast', settings.accessibility.highContrast);
    root.classList.toggle('reduce-motion', settings.accessibility.reduceMotion);
    if (settings.accessibility.largeText) {
      root.style.fontSize = '20px';
    } else {
      root.style.fontSize = '16px';
    }
  }, [settings.accessibility]);

  // Show onboarding on first visit
  useEffect(() => {
    if (!settings.onboardingComplete) {
      setShowOnboarding(true);
    }
  }, [settings.onboardingComplete]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <AudioController />

      {mode === 'menu' && (
        <HomePage onOpenSettings={() => setShowSettings(true)} />
      )}

      {mode === 'solo' && <SoloGame />}
      {mode === 'multiplayer' && <MultiplayerGame />}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
