import Konva from 'konva';

export function getWorldPointer(stage: Konva.Stage): { x: number; y: number } | null {
  const p = stage.getPointerPosition();
  if (!p) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  const pt = transform.point(p);
  return { x: pt.x, y: pt.y };
}


