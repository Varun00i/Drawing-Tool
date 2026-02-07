import { useState } from 'react';
import { useAppStore } from '../store';
import { Grid3x3, Move, Send, Eye } from 'lucide-react';

interface OnboardingProps {
  onClose: () => void;
}

const STEPS = [
  {
    icon: <Eye size={32} className="text-[#007AFF]" />,
    title: 'Choose a Reference',
    description: 'Select a difficulty and let AI generate a reference image — or pick from curated packs. View it side-by-side or in a floating window.',
  },
  {
    icon: <Grid3x3 size={32} className="text-[#007AFF]" />,
    title: 'Use the Grid',
    description: 'Enable a grid overlay (3×3, 4×4, up to 8×8) to guide your proportions. Toggle it on and off while you sketch.',
  },
  {
    icon: <Move size={32} className="text-[#007AFF]" />,
    title: 'Floating Reference',
    description: 'Drag the reference window anywhere on screen. Resize it, adjust opacity, or hide it when you need more canvas space.',
  },
  {
    icon: <Send size={32} className="text-[#007AFF]" />,
    title: 'Submit & Score',
    description: 'When you\'re done, hit Submit. Our server-side scoring engine analyzes contours, keypoints, and local detail to compute your accuracy percentage.',
  },
];

export function Onboarding({ onClose }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const { updateSettings } = useAppStore();

  const handleFinish = () => {
    updateSettings({ onboardingComplete: true });
    onClose();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && handleFinish()}>
      <div className="card w-full max-w-md mx-4 text-center animate-scale-in">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#F2F2F7] rounded-2xl flex items-center justify-center">
            {current.icon}
          </div>
          <h2 className="text-xl font-bold mb-2">{current.title}</h2>
          <p className="text-[#86868B] leading-relaxed">{current.description}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-[#007AFF] w-6' : 'bg-[#E5E5EA]'}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleFinish} className="btn-ghost flex-1">
            Skip
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary flex-1">
              Next
            </button>
          ) : (
            <button onClick={handleFinish} className="btn-primary flex-1">
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
