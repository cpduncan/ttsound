import { useEffect } from 'react';
import { listenerAnimator } from './animation/ListenerAnimator';
import { audioEngine } from './audio/AudioEngine';
import { CanvasView } from './canvas/CanvasView';
import { useSceneStore } from './store/sceneStore';
import { ContextMenu } from './ui/ContextMenu';
import { Inspector } from './ui/Inspector';
import { LeftTray } from './ui/LeftTray';
import { RightTray } from './ui/RightTray';

export default function App() {
  const leftOpen = useSceneStore((s) => s.ui.leftTrayOpen);

  useEffect(() => {
    audioEngine.start();
    listenerAnimator.start();
    return () => {
      listenerAnimator.stop();
      audioEngine.stop();
    };
  }, []);

  // `left-closed` lets the inspector slide over to the screen edge when the tool tray is tucked away.
  return (
    <div className={`app${leftOpen ? '' : ' left-closed'}`}>
      <CanvasView />
      <LeftTray />
      <Inspector />
      <RightTray />
      <ContextMenu />
    </div>
  );
}
