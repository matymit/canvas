import { describe } from 'vitest';

// Integration skeletons: skipped by default until Konva/canvas harness is in place.
// These outline the behaviors to be validated with a real Stage and layers.

describe.skip('Integration: Tool flows layer routing and auto-select', () => {
  // TODO: spin a Konva Stage with five-layer pipeline (background/main/highlighter/preview/overlay)
  // - draw rectangle/ellipse/triangle, ensure preview on Preview; commit to Main; selection created; tool switches to Select
});

describe.skip('Integration: Shape text overlay behavior', () => {
  // TODO: on commit, overlay opens centered; caret centered.
  // Typing expands overlay smoothly; element height grows incrementally; overlay repositions to recomputed inner box.
});

describe.skip('Integration: Renderer registry & module subscriptions', () => {
  // TODO: modules mount after layer creation; subscribe to relevant subsets; reconcile nodes; batchDraw main.
});

describe.skip('Integration: Transformer lifecycle with batching', () => {
  // TODO: one overlay Transformer; transformstart begins history batch; transformend normalizes geometry (scales->1), ends batch.
});

describe.skip('Integration: Drag with grid+guides snapping', () => {
  // TODO: grid-first rounding; fine alignment; overlay guides show during drag; cleared on end.
});

describe.skip('Integration: Persistence via IPC', () => {
  // TODO: save scene; reload; maps/sets rehydrate; order preserved; sanity checks.
});
