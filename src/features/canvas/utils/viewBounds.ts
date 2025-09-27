import type Konva from 'konva';

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getWorldViewportBounds(stage: Konva.Stage): WorldBounds {
  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;
  const position = stage.position();
  const width = stage.width();
  const height = stage.height();

  const minX = (-position.x) / scaleX;
  const minY = (-position.y) / scaleY;
  const maxX = (width - position.x) / scaleX;
  const maxY = (height - position.y) / scaleY;

  return { minX, minY, maxX, maxY };
}
