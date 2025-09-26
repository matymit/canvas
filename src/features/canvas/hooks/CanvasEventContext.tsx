// features/canvas/contexts/CanvasEventContext.tsx
import React, { createContext, useCallback, useMemo, useRef } from 'react';
import type Konva from 'konva';
import type {
  CanvasEventType,
  CanvasEventHandler,
  CanvasLayers,
  CanvasEventContextValue
} from './canvasEventTypes';

const CanvasEventContext = createContext<CanvasEventContextValue | null>(null);

export default CanvasEventContext;

type HandlersMap = Map<CanvasEventType, Set<CanvasEventHandler>>;

export const CanvasEventProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<CanvasLayers | null>(null);

  const handlersRef = useRef<HandlersMap>(new Map());
  const activeToolRef = useRef<string>('select');

  const on = useCallback<CanvasEventContextValue['on']>((type, handler) => {
    let set = handlersRef.current.get(type);
    if (!set) {
      set = new Set();
      handlersRef.current.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }, []);

  const off = useCallback<CanvasEventContextValue['off']>((type, handler) => {
    handlersRef.current.get(type)?.delete(handler);
  }, []);

  const emit = useCallback<CanvasEventContextValue['emit']>((type, evt) => {
    const set = handlersRef.current.get(type);
    if (!set || set.size === 0) return false;
    let consumed = false;
    for (const h of Array.from(set)) {
      const res = h(evt);
      if (res === true) consumed = true;
    }
    return consumed;
  }, []);

  const setStage = useCallback((stage: Konva.Stage | null) => {
    stageRef.current = stage;
  }, []);

  const setLayers = useCallback((layers: CanvasLayers | null) => {
    layersRef.current = layers;
  }, []);

  const setActiveTool = useCallback((toolId: string) => {
    activeToolRef.current = toolId;
  }, []);
  const getActiveTool = useCallback(() => activeToolRef.current, []);

  const value = useMemo<CanvasEventContextValue>(
    () => ({
      stageRef,
      layersRef,
      setStage,
      setLayers,
      on,
      off,
      emit,
      setActiveTool,
      getActiveTool,
    }),
    [on, off, emit, setStage, setLayers, setActiveTool, getActiveTool],
  );

  return <CanvasEventContext.Provider value={value}>{children}</CanvasEventContext.Provider>;
};