import type Konva from 'konva';

export function getWorldPointer(stage: Konva.Stage): { x: number; y: number } | null {
  const pointer = stage.getRelativePointerPosition?.() ?? stage.getPointerPosition();
  if (!pointer) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  const pt = transform.point(pointer);
  return { x: pt.x, y: pt.y };
}


