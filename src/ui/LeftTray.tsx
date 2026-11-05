import { useRef, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { viewport } from '../canvas/viewport';
import { applyParsedScene, exportSceneZip, parseSceneZip } from '../io/sceneZip';
import { useSceneStore } from '../store/sceneStore';

export function LeftTray() {
  const sceneName = useSceneStore((s) => s.scene.name);
  const masterVolume = useSceneStore((s) => s.scene.masterVolume);
  const hasSelection = useSceneStore((s) => s.selectedEmitterId !== null);
  const queueOpen = useSceneStore((s) => s.ui.queuePanelOpen);
  const [busy, setBusy] = useState(false);
  const loadInput = useRef<HTMLInputElement>(null);

  const onAdd = () => {
    audioEngine.ensureUnlocked();
    const st = useSceneStore.getState();
    const id = st.addEmitter({ x: viewport.cx, y: viewport.cy });
    st.select(id);
  };

  const onDuplicate = () => {
    const st = useSceneStore.getState();
    if (!st.selectedEmitterId) return;
    const id = st.duplicateEmitter(st.selectedEmitterId);
    if (id) st.select(id);
  };

  const onDelete = () => {
    const st = useSceneStore.getState();
    if (st.selectedEmitterId) st.removeEmitter(st.selectedEmitterId);
  };

  const onNew = () => {
    if (useSceneStore.getState().scene.emitters.length > 0 && !window.confirm('Start a new scene? Unsaved changes are lost.')) return;
    audioEngine.disposeAll();
    useSceneStore.getState().resetScene();
  };

  const onSave = async () => {
    setBusy(true);
    try {
      await exportSceneZip();
    } catch (err) {
      window.alert(`Could not save scene: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const onLoadClick = () => {
    audioEngine.ensureUnlocked();
    loadInput.current?.click();
  };

  const onLoadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    audioEngine.ensureUnlocked();
    setBusy(true);
    try {
      const parsed = await parseSceneZip(file);
      const hasContent = useSceneStore.getState().scene.emitters.length > 0;
      if (hasContent && !window.confirm('Replace the current scene with the loaded one? Unsaved changes are lost.')) return;
      applyParsedScene(parsed);
      audioEngine.ensureUnlocked();
      if (parsed.missingTrackCount > 0) {
        window.alert(`${parsed.missingTrackCount} track(s) have no audio file in this zip and will be skipped.`);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="left-tray">
      <input
        type="text"
        className="scene-name"
        aria-label="Scene name"
        value={sceneName}
        onChange={(e) => useSceneStore.getState().setSceneName(e.target.value)}
      />
      <button onClick={onAdd}>Add Emitter</button>
      <button onClick={onDuplicate} disabled={!hasSelection}>
        Duplicate
      </button>
      <button onClick={onDelete} disabled={!hasSelection}>
        Delete selected
      </button>
      <hr />
      <button onClick={onNew} disabled={busy}>
        New Scene
      </button>
      <button onClick={onSave} disabled={busy}>
        Save Scene (.zip)
      </button>
      <button onClick={onLoadClick} disabled={busy}>
        Load Scene (.zip)
      </button>
      <input ref={loadInput} type="file" accept=".zip,application/zip" hidden onChange={onLoadChange} />
      <hr />
      <label className="field-col">
        Master volume
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => useSceneStore.getState().setMasterVolume(parseFloat(e.target.value))}
        />
      </label>
      <button onClick={() => useSceneStore.getState().toggleQueuePanel()}>{queueOpen ? 'Hide queue' : 'Show queue'}</button>
    </div>
  );
}
