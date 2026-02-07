import { useAppStore } from '../store';
import { useAudio } from '../hooks/useAudio';
import { useEffect } from 'react';

export function AudioController() {
  const { settings } = useAppStore();

  const { startMusic, stopMusic, musicPlaying } = useAudio({
    musicVolume: settings.audio.musicVolume,
    sfxVolume: settings.audio.sfxVolume,
    musicMuted: settings.audio.musicMuted,
    sfxMuted: settings.audio.sfxMuted,
    masterMuted: settings.audio.masterMuted || settings.accessibility.audioDisabled,
  });

  // Auto-start music if unmuted (requires user interaction first)
  useEffect(() => {
    const handleInteraction = () => {
      if (!settings.audio.musicMuted && !settings.audio.masterMuted && !settings.accessibility.audioDisabled) {
        startMusic();
      }
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, [settings.audio.musicMuted, settings.audio.masterMuted, settings.accessibility.audioDisabled, startMusic]);

  // Stop/start on mute changes
  useEffect(() => {
    if (settings.audio.musicMuted || settings.audio.masterMuted || settings.accessibility.audioDisabled) {
      stopMusic();
    }
  }, [settings.audio.musicMuted, settings.audio.masterMuted, settings.accessibility.audioDisabled, stopMusic]);

  return null;
}
