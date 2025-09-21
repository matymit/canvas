// features/canvas/interactions/overlay/SpacingHUD.ts
import Konva from 'konva';

export interface SpacingHUD {
  showGaps(layer: Konva.Layer, a: Konva.Node, b: Konva.Node): void;
  clear(layer: Konva.Layer): void;
}

export function createSpacingHUD(): SpacingHUD {
  const labels: Konva.Text[] = [];

  const clear = (layer: Konva.Layer) => {
    labels.forEach(l => { try { l.destroy(); } catch (error) {
      // Ignore cleanup errors
      // Silently ignore cleanup errors
    } });
    labels.length = 0;
    layer.batchDraw();
  };

  const showGaps = (layer: Konva.Layer, a: Konva.Node, b: Konva.Node) => {
    clear(layer);
    const ra = a.getClientRect({ skipStroke: true, skipShadow: true });
    const rb = b.getClientRect({ skipStroke: true, skipShadow: true });
    const midY = Math.min(ra.y + ra.height, rb.y + rb.height) + Math.abs((rb.y - ra.y)) / 2;
    const gap = Math.max(0, Math.min(rb.x, ra.x) === ra.x ? rb.x - (ra.x + ra.width) : ra.x - (rb.x + rb.width));
    const label = new Konva.Text({
      x: Math.min(ra.x + ra.width, rb.x + rb.width) + 6,
      y: midY,
      text: `${Math.round(gap)} px`,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 12,
      fill: '#6B7280',
      listening: false,
      perfectDrawEnabled: false,
      name: 'spacing-hud',
    });
    labels.push(label);
    layer.add(label);
    layer.batchDraw();
  };

  return { showGaps, clear };
}