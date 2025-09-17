// src/test/stubs/konva.ts
// Very small Konva stub used for unit tests that don't need actual drawing.
class Node {
  attrs: Record<string, any>;
  _parent: any = null;
  _children: any[] = [];
  _destroyed = false;
  constructor(attrs: any = {}) { this.attrs = { ...attrs }; }
  add(child: any) { child._parent = this; this._children.push(child); return this; }
  destroy() { this._destroyed = true; if (this._parent) { const i = this._parent._children.indexOf(this); if (i>=0) this._parent._children.splice(i,1); } }
  isDestroyed() { return this._destroyed; }
  moveTo(parent: any) { if (this._parent) { const i = this._parent._children.indexOf(this); if (i>=0) this._parent._children.splice(i,1); } parent.add(this); }
  setAttrs(next: any) { Object.assign(this.attrs, next); }
  getLayer() { let p: any = this._parent; while (p && !(p instanceof Layer)) p = p._parent; return p || null; }
}
class Group extends Node { constructor(attrs: any = {}) { super(attrs); } }
class Layer extends Group {
  _drawCount = 0;
  batchDraw() { this._drawCount++; }
  findOne(selector: string) {
    const m = selector.match(/\[id=\"(.+?)\"\]/);
    const id = m?.[1];
    if (!id) return null;
    const dfs = (n: any): any => {
      if (n.attrs?.id === id) return n;
      for (const c of n._children) { const r = dfs(c); if (r) return r; }
      return null;
    };
    return dfs(this);
  }
}
class Text extends Node { constructor(attrs: any = {}) { super(attrs); } }
class Rect extends Node { constructor(attrs: any = {}) { super(attrs); } }
class Circle extends Node { constructor(attrs: any = {}) { super(attrs); } }
class Line extends Node { constructor(attrs: any = {}) { super(attrs); } }

