import { useEffect, useRef } from 'react';
import { MIN_RADIUS, useSceneStore } from '../store/sceneStore';

const MENU_W = 230;
const MENU_H = 190;

/** Right-click (desktop) / long-press (touch) quick settings for one emitter. */
export function ContextMenu() {
  const menu = useSceneStore((s) => s.ui.contextMenu);
  const emitter = useSceneStore((s) => (s.ui.contextMenu ? s.scene.emitters.find((e) => e.id === s.ui.contextMenu?.emitterId) : undefined));
  const ref = useRef<HTMLDivElement>(null);
  const open = menu !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => useSceneStore.getState().closeContextMenu();
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!menu || !emitter) return null;
  const update = useSceneStore.getState().updateEmitter;
  const left = Math.max(4, Math.min(menu.x, window.innerWidth - MENU_W - 4));
  const top = Math.max(4, Math.min(menu.y, window.innerHeight - MENU_H - 4));

  return (
    <div ref={ref} className="context-menu" style={{ left, top, width: MENU_W }}>
      <strong>{emitter.name}</strong>
      <label className="field-col">
        Radius ({Math.round(emitter.radius)})
        <input
          type="range"
          min={MIN_RADIUS}
          max={1000}
          step={1}
          value={emitter.radius}
          onChange={(e) => update(emitter.id, { radius: parseFloat(e.target.value) })}
        />
      </label>
      <label className="field-col">
        Volume ({Math.round(emitter.volume * 100)}%)
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={emitter.volume}
          onChange={(e) => update(emitter.id, { volume: parseFloat(e.target.value) })}
        />
      </label>
      <label className="row">
        <input type="checkbox" checked={emitter.muted} onChange={(e) => update(emitter.id, { muted: e.target.checked })} />
        Muted
      </label>
      <div className="row">
        <button onClick={() => useSceneStore.getState().removeEmitter(emitter.id)}>Delete</button>
        <button onClick={() => useSceneStore.getState().closeContextMenu()}>Close</button>
      </div>
    </div>
  );
}
