import { useAppStore } from '../store';
import { X, Volume2, VolumeX, Eye, Sun, Moon, Type, Zap } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateAudio, updateAccessibility } = useAppStore();
  const { audio, accessibility } = settings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="tool-btn !min-w-[36px] !min-h-[36px]" aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        {/* Audio Section */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4">Audio</h3>

          {/* Master toggle */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {audio.masterMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              <span className="font-medium">Master Audio</span>
            </div>
            <ToggleSwitch
              checked={!audio.masterMuted}
              onChange={(v) => updateAudio({ masterMuted: !v })}
            />
          </div>

          {/* Music */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Background Music</span>
              <ToggleSwitch
                checked={!audio.musicMuted}
                onChange={(v) => updateAudio({ musicMuted: !v })}
              />
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={audio.musicVolume}
              onChange={(e) => updateAudio({ musicVolume: parseFloat(e.target.value) })}
              className="w-full accent-[#007AFF]"
              disabled={audio.musicMuted || audio.masterMuted}
            />
          </div>

          {/* SFX */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Sound Effects</span>
              <ToggleSwitch
                checked={!audio.sfxMuted}
                onChange={(v) => updateAudio({ sfxMuted: !v })}
              />
            </div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={audio.sfxVolume}
              onChange={(e) => updateAudio({ sfxVolume: parseFloat(e.target.value) })}
              className="w-full accent-[#007AFF]"
              disabled={audio.sfxMuted || audio.masterMuted}
            />
          </div>

          <p className="text-xs text-[#86868B] mt-2">
            Submit chime and match-complete sting are muted by default.
          </p>
        </section>

        {/* Accessibility Section */}
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-4">Accessibility</h3>

          <div className="space-y-1">
            <SettingsRow
              icon={<Sun size={18} />}
              label="High Contrast"
              checked={accessibility.highContrast}
              onChange={(v) => updateAccessibility({ highContrast: v })}
            />
            <SettingsRow
              icon={<Zap size={18} />}
              label="Reduce Motion"
              checked={accessibility.reduceMotion}
              onChange={(v) => updateAccessibility({ reduceMotion: v })}
            />
            <SettingsRow
              icon={<Type size={18} />}
              label="Large Text"
              checked={accessibility.largeText}
              onChange={(v) => updateAccessibility({ largeText: v })}
            />
            <SettingsRow
              icon={<VolumeX size={18} />}
              label="Disable All Audio"
              checked={accessibility.audioDisabled}
              onChange={(v) => updateAccessibility({ audioDisabled: v })}
            />
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-semibold text-[#86868B] uppercase tracking-wider mb-3">About</h3>
          <p className="text-sm text-[#86868B] leading-relaxed">
            Accuracy Sketch AI v1.0.0<br />
            Practice solo or compete live: sketch, submit, score.
          </p>
        </section>
      </div>
    </div>
  );
}

// ── Toggle Switch ──
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2
        ${checked ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

// ── Settings Row ──
function SettingsRow({
  icon, label, checked, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-2 hover:bg-[#F2F2F7] rounded-apple transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-[#86868B]">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}
