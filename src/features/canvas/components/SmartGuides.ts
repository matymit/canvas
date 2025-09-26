import Konva from 'konva';

export type GuideLine =
  | { type: 'v'; x: number; y1: number; y2: number; color?: string; dash?: number[]; strokeWidth?: number; label?: string }
  | { type: 'h'; y: number; x1: number; x2: number; color?: string; dash?: number[]; strokeWidth?: number; label?: string }
  | { type: 'seg'; x1: number; y1: number; x2: number; y2: number; color?: string; dash?: number[]; strokeWidth?: number; label?: string };

export interface SmartGuidesOptions {
  color?: string;
  strokeWidth?: number;
  dash?: number[];
  showLabels?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontFill?: string;
}

const DEFAULTS: Required<SmartGuidesOptions> = {
  color: '#3B82F6', // blue-500
  strokeWidth: 1,
  dash: [4, 4],
  showLabels: true,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontFill: '#3B82F6',
};

export class SmartGuides {
  private readonly layer: Konva.Layer;
  private readonly group: Konva.Group;
  private readonly options: Required<SmartGuidesOptions>;
  private lines: Konva.Line[] = [];
  private texts: Konva.Text[] = [];

  constructor(overlayLayer: Konva.Layer, opts?: SmartGuidesOptions) {
    this.layer = overlayLayer;
    this.options = { ...DEFAULTS, ...opts };
    this.group = new Konva.Group({
      listening: false,
      name: 'smart-guides',
    });
    this.layer.add(this.group);
  }

  private acquireLine(): Konva.Line {
    const ln = new Konva.Line({
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      hitStrokeWidth: 0,
    });
    this.group.add(ln);
    this.lines.push(ln);
    return ln;
  }

  private acquireText(): Konva.Text {
    const t = new Konva.Text({
      listening: false,
      perfectDrawEnabled: false,
      fontFamily: this.options.fontFamily,
      fontSize: this.options.fontSize,
      fill: this.options.fontFill,
      align: 'center',
    });
    this.group.add(t);
    this.texts.push(t);
    return t;
  }

  clear() {
    this.lines.forEach((n) => n.destroy());
    this.texts.forEach((n) => n.destroy());
    this.lines = [];
    this.texts = [];
    this.layer.batchDraw();
  }

  setVisible(visible: boolean) {
    this.group.visible(visible);
    this.layer.batchDraw();
  }

  show(guides: GuideLine[]) {
    // Destroy previous to keep it simple; this can be replaced with a pool if desired.
    this.clear();

    for (const g of guides) {
      const color = g.color ?? this.options.color;
      const strokeWidth = g.strokeWidth ?? this.options.strokeWidth;
      const dash = g.dash ?? this.options.dash;

      const line = this.acquireLine();
      if (g.type === 'v') {
        line.points([g.x, g.y1, g.x, g.y2]);
      } else if (g.type === 'h') {
        line.points([g.x1, g.y, g.x2, g.y]);
      } else {
        line.points([g.x1, g.y1, g.x2, g.y2]);
      }
      line.stroke(color).strokeWidth(strokeWidth).dash(dash);

      if (this.options.showLabels && g.label) {
        const text = this.acquireText();
        if (g.type === 'v') {
          const midY = (g.y1 + g.y2) / 2;
          text.text(g.label);
          text.position({ x: g.x + 6, y: midY - this.options.fontSize / 2 });
        } else if (g.type === 'h') {
          const midX = (g.x1 + g.x2) / 2;
          text.text(g.label);
          text.position({ x: midX - text.width() / 2, y: g.y + 6 });
        } else {
          const midX = (g.x1 + g.x2) / 2;
          const midY = (g.y1 + g.y2) / 2;
          text.text(g.label);
          text.position({ x: midX - text.width() / 2, y: midY - this.options.fontSize / 2 });
        }
      }
    }

    this.layer.batchDraw();
  }

  destroy() {
    try {
      this.group.destroy();
    } catch {
      // ignore
    }
    this.lines = [];
    this.texts = [];
  }
}

export default SmartGuides;