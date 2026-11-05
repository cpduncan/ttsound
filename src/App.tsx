import { useEffect } from 'react';
import { audioEngine } from './audio/AudioEngine';
import { CanvasView } from './canvas/CanvasView';
import { ContextMenu } from './ui/ContextMenu';
import { Inspector } from './ui/Inspector';
import { LeftTray } from './ui/LeftTray';
import { RightTray } from './ui/RightTray';

export default function App() {
  useEffect(() => {
    audioEngine.start();
    return () => audioEngine.stop();
  }, []);

  return (
    <>
      <CanvasView />
      <LeftTray />
      <Inspector />
      <RightTray />
      <ContextMenu />
    </>
  );
}
