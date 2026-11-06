import { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { useAnimationStore } from '../store/animationStore';
import { useSceneStore } from '../store/sceneStore';
import type { Vec2 } from '../types';
import { hitTest, type Hit } from './hitTest';
import { render } from './renderer';
import { panBy, screenToWorld, viewport, zoomAt } from './viewport';

const LONG_PRESS_MS = 500;
/** Movement (screen px) before a press counts as a drag instead of a click / long-press. */
const MOVE_TOLERANCE = 6;

type Drag =
  | { kind: 'listener'; offset: Vec2 }
  | { kind: 'emitter'; id: string; offset: Vec2 }
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'pinch'; lastDist: number; lastMidX: number; lastMidY: number }
  | null;

/**
 * The canvas never subscribes to the store through React. Its rAF loop and its
 * pointer handlers read/write via getState(), so dragging causes zero React renders.
 */
export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('resize', resize);

    let raf = 0;
    const frame = () => {
      const { scene, selectedEmitterId } = useSceneStore.getState();
      const { target, armed } = useAnimationStore.getState();
      render(ctx2d, { width: w, height: h, dpr }, scene, selectedEmitterId, viewport, target);
      if (armed) canvas.style.cursor = 'crosshair';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ---------------------------------------------------------- pointers
    const pointers = new Map<number, Vec2>();
    let drag: Drag = null;
    let downPos: Vec2 = { x: 0, y: 0 };
    let moved = false;
    let pressedHit: Hit = { kind: 'none' };
    /** This press began while "Animate Listener" was armed: a click (no drag) places the target. */
    let armedPress = false;
    let longPressTimer: number | null = null;

    const local = (e: { clientX: number; clientY: number }): Vec2 => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const cancelLongPress = () => {
      if (longPressTimer !== null) window.clearTimeout(longPressTimer);
      longPressTimer = null;
    };
    const startPinch = () => {
      const [a, b] = Array.from(pointers.values());
      if (!a || !b) return;
      drag = {
        kind: 'pinch',
        lastDist: Math.hypot(a.x - b.x, a.y - b.y),
        lastMidX: (a.x + b.x) / 2,
        lastMidY: (a.y + b.y) / 2,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return; // right-click handled by 'contextmenu'
      audioEngine.ensureUnlocked();
      const st = useSceneStore.getState();
      st.closeContextMenu();
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);

      if (pointers.size === 2) {
        cancelLongPress();
        startPinch();
        return;
      }
      if (pointers.size > 2) return;

      moved = false;
      downPos = p;
      if (useAnimationStore.getState().armed) {
        // Target-picking mode: skip hit-testing, any click is a target. Dragging still pans.
        armedPress = true;
        pressedHit = { kind: 'none' };
        drag = { kind: 'pan', lastX: p.x, lastY: p.y };
        return;
      }
      const world = screenToWorld(viewport, p, w, h);
      const hit = hitTest(st.scene, world, viewport.zoom);
      pressedHit = hit;

      if (hit.kind === 'listener') {
        const lp = st.scene.listener.position;
        drag = { kind: 'listener', offset: { x: lp.x - world.x, y: lp.y - world.y } };
      } else if (hit.kind === 'emitter') {
        const em = st.scene.emitters.find((x) => x.id === hit.id);
        if (!em) return;
        st.select(hit.id);
        drag = { kind: 'emitter', id: hit.id, offset: { x: em.position.x - world.x, y: em.position.y - world.y } };
        if (e.pointerType !== 'mouse') {
          const { clientX, clientY } = e;
          longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            drag = null;
            useSceneStore.getState().openContextMenu(hit.id, clientX, clientY);
          }, LONG_PRESS_MS);
        }
      } else {
        drag = { kind: 'pan', lastX: p.x, lastY: p.y };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const st = useSceneStore.getState();
          const hit = hitTest(st.scene, screenToWorld(viewport, local(e), w, h), viewport.zoom);
          canvas.style.cursor = useAnimationStore.getState().armed ? 'crosshair' : hit.kind === 'none' ? 'default' : 'pointer';
        }
        return;
      }
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (!drag) return;

      if (drag.kind === 'pinch') {
        const [a, b] = Array.from(pointers.values());
        if (!a || !b) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        if (drag.lastDist > 0 && d > 0) zoomAt(viewport, { x: mx, y: my }, d / drag.lastDist, w, h);
        panBy(viewport, mx - drag.lastMidX, my - drag.lastMidY);
        drag = { kind: 'pinch', lastDist: d, lastMidX: mx, lastMidY: my };
        return;
      }

      if (!moved && Math.hypot(p.x - downPos.x, p.y - downPos.y) > MOVE_TOLERANCE) {
        moved = true;
        cancelLongPress();
      }

      const st = useSceneStore.getState();
      switch (drag.kind) {
        case 'pan':
          panBy(viewport, p.x - drag.lastX, p.y - drag.lastY);
          drag = { kind: 'pan', lastX: p.x, lastY: p.y };
          break;
        case 'listener': {
          if (!moved) break;
          const wp = screenToWorld(viewport, p, w, h);
          useAnimationStore.getState().clearTarget(); // manual drag takes control from the animation
          st.moveListener({ x: wp.x + drag.offset.x, y: wp.y + drag.offset.y });
          break;
        }
        case 'emitter': {
          if (!moved) break;
          const wp = screenToWorld(viewport, p, w, h);
          st.updateEmitter(drag.id, { position: { x: wp.x + drag.offset.x, y: wp.y + drag.offset.y } });
          break;
        }
      }
    };

    const onPointerEnd = (e: PointerEvent, cancelled: boolean) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      cancelLongPress();
      if (!cancelled && drag?.kind === 'pan' && !moved) {
        if (armedPress) {
          useAnimationStore.getState().setTarget(screenToWorld(viewport, local(e), w, h));
        } else if (pressedHit.kind === 'none') {
          useSceneStore.getState().select(null); // click on empty space
        }
      }
      armedPress = false;
      if (pointers.size === 0 || drag?.kind === 'pinch') drag = null;
    };
    const onPointerUp = (e: PointerEvent) => onPointerEnd(e, false);
    const onPointerCancel = (e: PointerEvent) => onPointerEnd(e, true);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : 1;
      zoomAt(viewport, local(e), Math.exp(-e.deltaY * unit * 0.0015), w, h);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const st = useSceneStore.getState();
      const hit = hitTest(st.scene, screenToWorld(viewport, local(e), w, h), viewport.zoom);
      if (hit.kind === 'emitter') {
        st.select(hit.id);
        st.openContextMenu(hit.id, e.clientX, e.clientY);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      cancelAnimationFrame(raf);
      cancelLongPress();
      ro.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return <canvas ref={canvasRef} className="scene-canvas" />;
}
