import { MIN_RADIUS, useSceneStore } from '../store/sceneStore';
import { Dock } from './Dock';
import { NumberField } from './NumberField';

export function Inspector() {
  const emitter = useSceneStore((s) => s.scene.emitters.find((e) => e.id === s.selectedEmitterId));
  const open = useSceneStore((s) => s.ui.inspectorOpen);
  if (!emitter) return null;

  const update = useSceneStore.getState().updateEmitter;
  const id = emitter.id;

  return (
    <Dock id="inspector" side="left" open={open} onToggle={() => useSceneStore.getState().toggleInspector()} label="inspector">
    <div className="inspector">
      <h3>Inspector</h3>
      <label className="field-col">
        Name
        <input type="text" value={emitter.name} onChange={(e) => update(id, { name: e.target.value })} />
      </label>

      <div className="field-col">
        Radius
        <div className="row">
          <input
            type="range"
            min={MIN_RADIUS}
            max={1000}
            step={1}
            value={emitter.radius}
            onChange={(e) => update(id, { radius: parseFloat(e.target.value) })}
          />
          <NumberField value={emitter.radius} min={MIN_RADIUS} step={1} ariaLabel="Radius" onCommit={(v) => update(id, { radius: v })} />
        </div>
      </div>

      <div className="field-col">
        Volume
        <div className="row">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={emitter.volume}
            onChange={(e) => update(id, { volume: parseFloat(e.target.value) })}
          />
          <NumberField value={emitter.volume} min={0} max={1} step={0.01} ariaLabel="Volume" onCommit={(v) => update(id, { volume: v })} />
        </div>
      </div>

      <label className="row">
        <input type="checkbox" checked={emitter.muted} onChange={(e) => update(id, { muted: e.target.checked })} />
        Muted
      </label>

      <div className="row">
        <span>x</span>
        <NumberField
          value={emitter.position.x}
          step={1}
          ariaLabel="X position"
          onCommit={(v) => update(id, { position: { x: v, y: emitter.position.y } })}
        />
        <span>y</span>
        <NumberField
          value={emitter.position.y}
          step={1}
          ariaLabel="Y position"
          onCommit={(v) => update(id, { position: { x: emitter.position.x, y: v } })}
        />
      </div>
    </div>
    </Dock>
  );
}
