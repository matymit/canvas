// features/canvas/hooks/useSpatialIndex.ts
import { useRef, useCallback } from 'react';

interface SpatialElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpatialIndex {
  insert: (element: SpatialElement) => void;
  remove: (id: string) => void;
  query: (bounds: { x: number; y: number; width: number; height: number }) => SpatialElement[];
  queryRect: (bounds: { x: number; y: number; width: number; height: number }) => SpatialElement[];
  clear: () => void;
}

const useSpatialIndex = (): SpatialIndex => {
  const elementsRef = useRef<Map<string, SpatialElement>>(new Map());

  const insert = useCallback((element: SpatialElement) => {
    elementsRef.current.set(element.id, element);
  }, []);

  const remove = useCallback((id: string) => {
    elementsRef.current.delete(id);
  }, []);

  const query = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    const results: SpatialElement[] = [];
    const { x, y, width, height } = bounds;
    
    elementsRef.current.forEach((element) => {
      // Simple AABB intersection test
      if (
        element.x < x + width &&
        element.x + element.width > x &&
        element.y < y + height &&
        element.y + element.height > y
      ) {
        results.push(element);
      }
    });
    
    return results;
  }, []);

  const clear = useCallback(() => {
    elementsRef.current.clear();
  }, []);

  const queryRect = useCallback((bounds: { x: number; y: number; width: number; height: number }) => {
    return query(bounds);
  }, [query]);

  return { insert, remove, query, queryRect, clear };
};

export default useSpatialIndex;