import { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { filesToTracks } from '../io/fileIngest';
import { blobStore } from '../store/blobStore';
import { useSceneStore } from '../store/sceneStore';
import type { Emitter, EmitterRuntime, GapMode } from '../types';
import { Dock } from './Dock';
import { NumberField } from './NumberField';
import { useDragReorder } from './useDragReorder';

export function RightTray() {
  const open = useSceneStore((s) => s.ui.queuePanelOpen);
  const emitter = useSceneStore((s) => s.scene.emitters.find((e) => e.id === s.selectedEmitterId));
  return (
    <Dock id="queue" side="right" open={open} onToggle={() => useSceneStore.getState().toggleQueuePanel()} label="queue">
      <div className="right-tray">
        <h3>Queue</h3>
        {open &&
          (emitter ? (
            <QueueManager key={emitter.id} emitter={emitter} />
          ) : (
            <p className="muted">Select an emitter to manage its sounds.</p>
          ))}
      </div>
    </Dock>
  );
}

function statusText(rt: EmitterRuntime | null): string {
  if (!rt) return 'Idle';
  switch (rt.state) {
    case 'playing':
      return 'Playing';
    case 'paused':
      return 'Paused (out of range)';
    case 'gap':
      return `Waiting gap (${rt.gapSecondsLeft}s left)`;
    default:
      return 'Idle';
  }
}

function QueueManager({ emitter }: { emitter: Emitter }) {
  const [runtime, setRuntime] = useState<EmitterRuntime | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const id = emitter.id;

  // Poll runtime status at ~4 Hz. It never lives in the scene or the persisted store.
  useEffect(() => {
    const read = () => setRuntime(audioEngine.getRuntime(id));
    read();
    const t = window.setInterval(read, 250);
    return () => window.clearInterval(t);
  }, [id]);

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const drag = useDragReorder({
    count: emitter.tracks.length,
    onReorder: (from, to) => useSceneStore.getState().reorderTrack(id, from, to),
    getContainer: () => listRef.current,
  });

  const ingest = (files: FileList | null) => {
    audioEngine.ensureUnlocked();
    const items = filesToTracks(files);
    if (items.length === 0) {
      setNotice(files && files.length > 0 ? 'No audio files found in that selection.' : null);
      return;
    }
    setNotice(null);
    useSceneStore.getState().addTracks(id, items);
  };

  const update = useSceneStore.getState().updateEmitter;
  const gap = emitter.gap;

  const setGapKind = (kind: GapMode['kind']) => {
    if (kind === 'immediate') update(id, { gap: { kind: 'immediate' } });
    else if (kind === 'fixed') update(id, { gap: { kind: 'fixed', seconds: gap.kind === 'fixed' ? gap.seconds : 5 } });
    else update(id, { gap: { kind: 'random', minSeconds: gap.kind === 'random' ? gap.minSeconds : 5, maxSeconds: gap.kind === 'random' ? gap.maxSeconds : 15 } });
  };

  return (
    <div>
      <p className="emitter-title">{emitter.name}</p>

      <div className="row wrap">
        <button
          onClick={() => {
            audioEngine.ensureUnlocked();
            filesInput.current?.click();
          }}
        >
          Add files
        </button>
        <button
          onClick={() => {
            audioEngine.ensureUnlocked();
            folderInput.current?.click();
          }}
        >
          Add folder
        </button>
      </div>
      <input
        ref={filesInput}
        type="file"
        multiple
        accept="audio/*"
        hidden
        onChange={(e) => {
          ingest(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          ingest(e.target.files);
          e.target.value = '';
        }}
      />
      {notice && <p className="error">{notice}</p>}

      <div ref={listRef} className="track-list">
        {emitter.tracks.length === 0 && <p className="muted">No tracks yet.</p>}
        {emitter.tracks.map((t, i) => {
          const current = runtime?.currentTrackId === t.id;
          const missing = !blobStore.has(t.id);
          return (
            <div
              key={t.id}
              ref={drag.registerRow(i)}
              className={`track-row${current ? ' current' : ''}${drag.dragIndex === i ? ' dragging' : ''}`}
              style={drag.getRowStyle(i)}
            >
              <span className="handle" title="Drag to reorder" aria-label="Drag to reorder" {...drag.getHandleProps(i)}>
                ⠿
              </span>
              <span className="track-name" title={t.name}>
                {current ? '▶ ' : ''}
                {t.name}
                {missing && <em className="error"> (missing)</em>}
              </span>
              <button aria-label={`Remove ${t.name}`} onClick={() => useSceneStore.getState().removeTrack(id, t.id)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <label className="field-col">
        Order
        <select value={emitter.order} onChange={(e) => update(id, { order: e.target.value === 'shuffle' ? 'shuffle' : 'inOrder' })}>
          <option value="inOrder">In order</option>
          <option value="shuffle">Shuffle</option>
        </select>
      </label>

      <label className="field-col">
        Next track / repeat
        <select value={gap.kind} onChange={(e) => setGapKind(e.target.value as GapMode['kind'])}>
          <option value="immediate">Immediately</option>
          <option value="fixed">Every X seconds</option>
          <option value="random">Random between X and Y seconds</option>
        </select>
      </label>

      {gap.kind === 'fixed' && (
        <div className="row">
          <span>X</span>
          <NumberField value={gap.seconds} min={0} step={1} ariaLabel="Seconds" onCommit={(v) => update(id, { gap: { kind: 'fixed', seconds: v } })} />
          <span>s</span>
        </div>
      )}
      {gap.kind === 'random' && (
        <div className="row">
          <span>X</span>
          <NumberField
            value={gap.minSeconds}
            min={0}
            step={1}
            ariaLabel="Minimum seconds"
            onCommit={(v) => update(id, { gap: { kind: 'random', minSeconds: v, maxSeconds: Math.max(gap.maxSeconds, v) } })}
          />
          <span>Y</span>
          <NumberField
            value={gap.maxSeconds}
            min={0}
            step={1}
            ariaLabel="Maximum seconds"
            onCommit={(v) => update(id, { gap: { kind: 'random', minSeconds: gap.minSeconds, maxSeconds: Math.max(v, gap.minSeconds) } })}
          />
          <span>s</span>
        </div>
      )}
      <p className="muted small">
        The gap is silence after a track ends. With 1 track + Immediately, the track loops seamlessly.
        {gap.kind === 'random' && ' Y is never allowed below X.'}
      </p>

      <div className="row">
        <button onClick={() => audioEngine.skipNext(id)} disabled={emitter.tracks.length === 0}>
          Skip next
        </button>
        <span className="status">{statusText(runtime)}</span>
      </div>
      {runtime?.error && <p className="error">{runtime.error}</p>}
    </div>
  );
}
