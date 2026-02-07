import { useRef, useEffect, useCallback, useState } from 'react';

interface AudioManagerOptions {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
  masterMuted: boolean;
}

export function useAudio(options: AudioManagerOptions) {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Create a simple bass+drums loop using Web Audio API
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.connect(audioCtxRef.current.destination);
    }
    return audioCtxRef.current;
  }, []);

  // Generate a gentle loop programmatically
  const generateMusicBuffer = useCallback(async () => {
    const ctx = getAudioContext();
    const sampleRate = ctx.sampleRate;
    const duration = 8; // 8-second loop
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const beat = (t * 2) % 1; // 120 BPM
      const measure = (t / 2) % 1;

      // Soft bass (sine wave following a simple pattern)
      const bassFreqs = [65.41, 73.42, 82.41, 73.42]; // C2, D2, E2, D2
      const bassIdx = Math.floor((t / 2) % 4);
      const bass = Math.sin(2 * Math.PI * bassFreqs[bassIdx] * t) * 0.12;

      // Warm pad (very soft chord)
      const pad = (
        Math.sin(2 * Math.PI * 261.63 * t) * 0.02 +
        Math.sin(2 * Math.PI * 329.63 * t) * 0.015 +
        Math.sin(2 * Math.PI * 392.0 * t) * 0.015
      );

      // Gentle kick pattern
      const kickEnv = beat < 0.05 ? Math.exp(-beat * 60) : 0;
      const kick = Math.sin(2 * Math.PI * 55 * t * (1 + kickEnv * 2)) * kickEnv * 0.15;

      // Soft hi-hat
      const hatTiming = (t * 4) % 1;
      const hatEnv = hatTiming < 0.02 ? Math.exp(-hatTiming * 100) : 0;
      const hat = (Math.random() * 2 - 1) * hatEnv * 0.03;

      const sample = (bass + pad + kick + hat) * 0.6;
      left[i] = sample;
      right[i] = sample;
    }

    return buffer;
  }, [getAudioContext]);

  const startMusic = useCallback(async () => {
    if (options.masterMuted || options.musicMuted) return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const buffer = await generateMusicBuffer();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Fade in
      const gain = gainNodeRef.current!;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(options.musicVolume, ctx.currentTime + 0.5);

      source.connect(gain);
      source.start();
      musicSourceRef.current = source;
      setMusicPlaying(true);
    } catch (e) {
      console.warn('Music start failed:', e);
    }
  }, [options.masterMuted, options.musicMuted, options.musicVolume, getAudioContext, generateMusicBuffer]);

  const stopMusic = useCallback(() => {
    if (musicSourceRef.current && gainNodeRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      const gain = gainNodeRef.current;
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      setTimeout(() => {
        musicSourceRef.current?.stop();
        musicSourceRef.current = null;
        setMusicPlaying(false);
      }, 500);
    }
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const vol = (options.masterMuted || options.musicMuted) ? 0 : options.musicVolume;
      gainNodeRef.current.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
    }
  }, [options.musicVolume, options.musicMuted, options.masterMuted]);

  // Play SFX
  const playSfx = useCallback(async (type: 'submit' | 'complete') => {
    if (options.masterMuted || options.sfxMuted) return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'submit') {
        // Short upward chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(options.sfxVolume * 0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Match complete – short two-tone sting
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(options.sfxVolume * 0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      console.warn('SFX failed:', e);
    }
  }, [options.sfxVolume, options.sfxMuted, options.masterMuted, getAudioContext]);

  // Cleanup
  useEffect(() => {
    return () => {
      musicSourceRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  return { startMusic, stopMusic, musicPlaying, playSfx };
}
