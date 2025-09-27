import type Konva from 'konva';

export function getWorldPointer(stage: Konva.Stage): { x: number; y: number } | null {
  const pointer = stage.getPointerPosition();
  if (!pointer) return null;

  const stagePosition = stage.position();
  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;

  return {
    x: (pointer.x - stagePosition.x) / scaleX,
    y: (pointer.y - stagePosition.y) / scaleY,
  };
}
