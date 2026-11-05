import { useEffect, useState } from 'react';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  ariaLabel?: string;
  onCommit: (value: number) => void;
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/**
 * Number input that keeps its own text while focused, so typing "5" on the way
 * to "50" isn't instantly rewritten by a min clamp. Commits live on every valid keystroke.
 */
export function NumberField({ value, min, max, step = 1, width = 64, ariaLabel, onCommit }: Props) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  return (
    <input
      type="number"
      aria-label={ariaLabel}
      style={{ width }}
      value={text}
      min={min}
      max={max}
      step={step}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isFinite(n)) return;
        let v = n;
        if (min !== undefined) v = Math.max(min, v);
        if (max !== undefined) v = Math.min(max, v);
        onCommit(v);
      }}
    />
  );
}
