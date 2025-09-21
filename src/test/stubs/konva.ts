// src/test/stubs/konva.ts
// Very small Konva stub used for unit tests that don't need actual drawing.
class KonvaNode {
  attrs: Record<string, unknown>;
  _parent: KonvaNode | null = null;
  _children: KonvaNode[] = [];
  _destroyed = false;
  constructor(attrs: Record<string, unknown> = {}) { this.attrs = { ...attrs }; }
  add(child: KonvaNode) { child._parent = this; this._children.push(child); return this; }
  destroy() { this._destroyed = true; if (this._parent) { const i = this._parent._children.indexOf(this); if (i>=0) this._parent._children.splice(i,1); } }
  isDestroyed() { return this._destroyed; }
  moveTo(parent: KonvaNode) { if (this._parent) { const i = this._parent._children.indexOf(this); if (i>=0) this._parent._children.splice(i,1); } parent.add(this); }
  setAttrs(next: Record<string, unknown>) { Object.assign(this.attrs, next); }
  getLayer() { let p: KonvaNode | null = this._parent; while (p && !(p instanceof Layer)) p = p._parent; return p || null; }
}
class Group extends KonvaNode { constructor(attrs: Record<string, unknown> = {}) { super(attrs); } }
class Layer extends Group {
  _drawCount = 0;
  batchDraw() { this._drawCount++; }
  findOne(selector: string) {
    const m = selector.match(/\[id="(.+?)"\]/);
    const id = m?.[1];
    if (!id) return null;
    const dfs = (n: KonvaNode): KonvaNode | null => {
      if (n.attrs?.id === id) return n;
      for (const c of n._children) { const r = dfs(c); if (r) return r; }
      return null;
    };
    return dfs(this);
  }
}
class KonvaText extends KonvaNode { constructor(attrs: Record<string, unknown> = {}) { super(attrs); } }
class Rect extends KonvaNode { constructor(attrs: Record<string, unknown> = {}) { super(attrs); } }
class Circle extends KonvaNode { constructor(attrs: Record<string, unknown> = {}) { super(attrs); } }
class Line extends KonvaNode { constructor(attrs: Record<string, unknown> = {}) { super(attrs); } }

// Export classes with Konva-compatible names
export const Node = KonvaNode;
export const Text = KonvaText;
export { Group, Layer, Rect, Circle, Line };

