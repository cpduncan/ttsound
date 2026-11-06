import { useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { MIN_SPEED, SLIDER_MAX_SPEED, useAnimationStore } from '../store/animationStore';
import { NumberField } from './NumberField';

export function AnimationControls() {
  const speed = useAnimationStore((s) => s.speed);
  const playing = useAnimationStore((s) => s.playing);
  const armed = useAnimationStore((s) => s.armed);
  const hasTarget = useAnimationStore((s) => s.target !== null);

  // Escape cancels "pick a target" mode.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useAnimationStore.getState().disarm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [armed]);

  const st = useAnimationStore.getState();

  let status = 'No target';
  if (armed) status = 'Click the canvas to set a target';
  else if (hasTarget) status = playing ? 'Moving to target' : 'Paused';

  return (
    <div className="anim-controls">
      <label className="field-col">
        Animation speed (units/s)
        <input
          type="range"
          min={MIN_SPEED}
          max={SLIDER_MAX_SPEED}
          step={1}
          value={Math.min(speed, SLIDER_MAX_SPEED)}
          onChange={(e) => st.setSpeed(parseFloat(e.target.value))}
        />
        <NumberField value={speed} min={MIN_SPEED} step={1} width={80} ariaLabel="Animation speed" onCommit={st.setSpeed} />
      </label>
      <button
        className={armed ? 'active' : undefined}
        onClick={() => {
          audioEngine.ensureUnlocked();
          st.toggleArmed();
        }}
      >
        {armed ? 'Cancel (Esc)' : 'Animate Listener'}
      </button>
      <button
        onClick={() => {
          audioEngine.ensureUnlocked();
          st.togglePlaying();
        }}
      >
        {playing ? '⏸ Pause' : '▶ Play'}
      </button>
      <p className="muted small anim-status">{status}</p>
    </div>
  );
}
