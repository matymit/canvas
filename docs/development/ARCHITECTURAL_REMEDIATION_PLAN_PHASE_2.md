{
  "executable_tasks": [
    {
      "task_id": "P2-01",
      "description": "Merge highlighter layer into main layer using a non-interactive group (restore four-layer pipeline)",
      "target_files": [
        {
          "path": "src/features/canvas/components/FigJamCanvas.tsx",
          "line_range": "122-146",
          "function_name": "FigJamCanvas useEffect (stage initialization)"
        },
        {
          "path": "src/features/canvas/renderer/index.ts",
          "line_range": "158-167",
          "function_name": "CanvasRenderer.render"
        }
      ],
      "code_changes": [
        {
          "operation": "delete",
          "find_pattern": "const highlighterLayer = new Konva.Layer\\({ listening: false }\\);",
          "replace_with": "",
          "line_number": "124"
        },
        {
          "operation": "insert",
          "find_pattern": "const mainLayer = new Konva.Layer\\({ listening: true }\\);",
          "replace_with": "const mainLayer = new Konva.Layer({ listening: true });\\n    // Create highlighter group inside main layer for highlight strokes\\n    const highlighterGroup = new Konva.Group({ listening: false });\\n    mainLayer.add(highlighterGroup);",
          "line_number": "123"
        },
        {
          "operation": "delete",
          "find_pattern": "stage.add\\(highlighterLayer\\);",
          "replace_with": "",
          "line_number": "143"
        },
        {
          "operation": "replace",
          "find_pattern": "highlighter: highlighterLayer",
          "replace_with": "highlighter: highlighterGroup",
          "line_number": "130"
        },
        {
          "operation": "replace",
          "find_pattern": "highlighter: highlighterLayer",
          "replace_with": "highlighter: highlighterGroup",
          "line_number": "165"
        },
        {
          "operation": "delete",
          "find_pattern": "this\\.layers\\.highlighter\\.batchDraw\\(\\);",
          "replace_with": "",
          "line_number": "162"
        }
      ],
      "validation_steps": [
        "npm run build && npm run start  # Application should compile and run",
        "Manual test: Draw highlighter strokes and other shapes; confirm highlighter strokes always render behind other elements and cannot be selected on click",
        "Manual test: Existing selection and undo/redo functionality still works for highlight strokes (e.g., erasing highlights, undo erase brings them back)",
        "Inspect DOM via Konva inspector or console: ensure only 4 Konva layers (background, main, preview, overlay) exist on stage (no separate highlighter layer)"
      ],
      "success_criteria": "The canvas now uses exactly four layers. Highlighter strokes are rendered on the main layer (visually behind other content) via a non-interactive group. No functionality is lost: highlights still appear correctly and remain unselectable, and overall rendering/selection order matches the blueprint.",
      "dependencies": []
    },
    {
      "task_id": "P2-02",
      "description": "Eliminate direct Konva node manipulation in drawing tool commits by relying solely on store updates",
      "target_files": [
        {
          "path": "src/features/canvas/components/tools/drawing/PenTool.tsx",
          "line_range": "59-69",
          "function_name": "commitStroke() internal"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/EraserTool.tsx",
          "line_range": "59-69",
          "function_name": "commitStroke() internal"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/MarkerTool.tsx",
          "line_range": "similar to PenTool",
          "function_name": "commitStroke() internal"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/HighlighterTool.tsx",
          "line_range": "similar to PenTool",
          "function_name": "commitStroke() internal"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "line\\.moveTo\\(main\\);\\s*main\\.batchDraw\\(\\);",
          "replace_with": "line.destroy();\\n         stageNow.draw();  // Remove preview line once stroke is stored in state",
          "line_number": "62"
        },
        {
          "operation": "replace",
          "find_pattern": "line.moveToTop\\(\\);\\s*stageNow.draw\\(\\);",
          "replace_with": "line.destroy();\\n         stageNow.draw();",
          "line_number": "66"
        }
      ],
      "validation_steps": [
        "Manual test: Draw a pen stroke, marker stroke, highlighter stroke, and eraser stroke. Verify that upon releasing the mouse, the stroke remains visible (committed to the main layer via store) with no flicker or duplicates:contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}.",
        "Manual test: Perform multiple drawings and undo/redo them. All strokes should undo/redo correctly once (no double entries).",
        "Manual test: Rapidly draw strokes and observe console/performance—there should be no direct Konva errors and no leftover Konva.Line nodes beyond those managed by the DrawingRenderer."
      ],
      "success_criteria": "Drawing tool strokes (pen/marker/highlighter/eraser) are no longer manually moved into the main layer. Instead, they are removed from the preview on commit and rely on the store's DrawingRenderer to render the final stroke. This prevents duplicate Konva nodes and ensures all stroke commits are handled through the unified state/history system.",
      "dependencies": []
    },
    {
      "task_id": "P2-03",
      "description": "Consolidate drawing tool logic using a shared module to reduce duplication",
      "target_files": [
        {
          "path": "src/features/canvas/components/tools/drawing/PenTool.tsx",
          "line_range": "37-49",
          "function_name": "PenTool component"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/MarkerTool.tsx",
          "line_range": "similar structure",
          "function_name": "MarkerTool component"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/HighlighterTool.tsx",
          "line_range": "similar structure",
          "function_name": "HighlighterTool component"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/EraserTool.tsx",
          "line_range": "similar structure",
          "function_name": "EraserTool component"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "import Konva from 'konva';",
          "replace_with": "import DrawingModule from '../../../renderer/modules/DrawingModule';",
          "line_number": "1"
        },
        {
          "operation": "replace",
          "find_pattern": "useEffect\\(\\(\\) => \\{[^]*if \\(isActive\\) \\{[^]*stage\\.on\\('pointerdown', onPointerDown\\);[^]*stage\\.off\\('pointerleave', onPointerLeave\\);[^]*\\};\\s*\\}, \\[isActive, stageRef\\]\\);",
          "replace_with": "// Use shared DrawingModule for pointer events\\n    useEffect(() => {\\n      const stage = stageRef.current;\\n      if (!stage || !isActive) return;\\n      const drawModule = new DrawingModule({\\n        color: () => color, width: () => size, opacity: () => opacity, multiplyBlend: toolName === 'highlighter'\\n      }, stage);\\n      stage.on('pointerdown', drawModule.onPointerDown);\\n      stage.on('pointermove', drawModule.onPointerMove);\\n      stage.on('pointerup', drawModule.onPointerUp);\\n      stage.on('pointerleave', drawModule.onPointerUp);\\n      return () => stage.off('.drawing');\\n    }, [isActive]);",
          "line_number": "42"
        }
      ],
      "validation_steps": [
        "Manual test: Verify that pen, marker, highlighter, and eraser tools all still function identically (drawing smooth lines, correctly committing to state). There should be no regression in behavior:contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}.",
        "Code review: The four drawing tool components now share the same DrawingModule logic (initialization, RAF batching, commit handling), reducing duplicate code.",
        "Run `npm run type-check` to ensure no new type errors were introduced by this refactor."
      ],
      "success_criteria": "All freehand drawing tools use a unified implementation for pointer event handling and stroke creation. The code duplication for Pen/Marker/Highlighter/Eraser is eliminated, reducing maintenance overhead and ensuring consistent behavior (e.g., RAF batching, coordinate handling) across these tools.",
      "dependencies": []
    },
    {
      "task_id": "P2-04",
      "description": "Make multi-element deletion atomic in history by using removeElements instead of looping removeElement",
      "target_files": [
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "938-948",
          "function_name": "selection.deleteSelected"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "selectedIds.forEach\\((id) => \\{[^]*removeElement\\?\\?\\(id\\);[^]*\\}\\);",
          "replace_with": "if (selectedIds.length === 0) return;\\n        const removeMultiple = (state as any).removeElements ?? (state as any).element?.removeElements;\\n        if (removeMultiple) {\\n          removeMultiple(selectedIds, { pushHistory: true, deselect: false });\\n        } else {\\n          selectedIds.forEach((id) => { (state as any).removeElement?.(id, { pushHistory: true }); });\\n        }",
          "line_number": "939"
        }
      ],
      "validation_steps": [
        "Run `npm run test:unit` for any selection or history tests (or add one) to ensure deleting multiple elements creates a single undo step.",
        "Manual test: Select multiple elements on the canvas (e.g., using marquee or Shift+click) and press Delete. Verify that a single undo action reverses the deletion of all elements as a group (all come back together).",
        "Manual test: Delete multiple elements and check the history stack (if visible or via devtools) – it should record one unified action (not one per element):contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}."
      ],
      "success_criteria": "Deleting multiple selected elements is now treated as one atomic action. Undoing a multi-delete restores all elements at once (and redo re-deletes them together), aligning with the atomic undo/redo design. The history log shows a single entry for the bulk deletion, and no extra selection clearing actions appear as separate history entries.",
      "dependencies": []
    },
    {
      "task_id": "P2-05",
      "description": "Consolidate Zustand UI slice to eliminate duplicate state properties",
      "target_files": [
        {
          "path": "src/features/canvas/stores/unifiedCanvasStore.ts",
          "line_range": "261-290",
          "function_name": "ConvenienceSlice (UI state)"
        },
        {
          "path": "src/features/canvas/stores/unifiedCanvasStore.ts",
          "line_range": "133-142",
          "function_name": "UISlice interface definition"
        }
      ],
      "code_changes": [
        {
          "operation": "delete",
          "find_pattern": "selectedTool: DEFAULT_UI.selectedTool,\\s*strokeColor: DEFAULT_UI.strokeColor,\\s*fillColor: DEFAULT_UI.fillColor,\\s*strokeWidth: DEFAULT_UI.strokeWidth,\\s*stickyNoteColor: \"#FFF59D\",",
          "replace_with": "",
          "line_number": "261"
        },
        {
          "operation": "delete",
          "find_pattern": "setSelectedTool: \\(tool: string\\) =>[\\s\\S]*?setStrokeWidth: \\(width: number\\) => \\{[\\s\\S]*?\\},",
          "replace_with": "",
          "line_number": "267"
        },
        {
          "operation": "delete",
          "find_pattern": "undo: \\(\\) => historyModule.undo\\(\\),\\s*redo: \\(\\) => historyModule.redo\\(\\),",
          "replace_with": "",
          "line_number": "293"
        },
        {
          "operation": "replace",
          "find_pattern": "ui: \\{[\\s\\S]*?stickyNoteColor: \"#FFF59D\",",
          "replace_with": "ui: {  // Unified UI state (single source of truth)\\n            selectedTool: DEFAULT_UI.selectedTool,\\n            strokeColor: DEFAULT_UI.strokeColor,\\n            fillColor: DEFAULT_UI.fillColor,\\n            strokeWidth: DEFAULT_UI.strokeWidth,\\n            stickyNoteColor: \"#FFF59D\",",
          "line_number": "298"
        }
      ],
      "validation_steps": [
        "Run `npm run type-check`. Verify no references to removed root properties cause errors (update any components still using `state.selectedTool` or similar to use `state.ui.selectedTool`).",
        "Manual test: Tool switching still works. Select different tools via the toolbar; the state updates and the correct tool is active (since we've unified on `ui.selectedTool`, this should remain seamless).",
        "Manual test: Stroke color, fill color, stroke width changes (if UI has controls for these) still reflect in drawing tools and shapes as before.",
        "Inspect store state (via browser console `useUnifiedCanvasStore.getState()`): confirm that `selectedTool`, `strokeColor`, etc. now appear only under the `ui` object, and not as duplicate top-level keys."
      ],
      "success_criteria": "The Zustand store no longer maintains duplicate UI state. All UI-related properties (selectedTool, colors, etc.) exist in a single slice (e.g., `state.ui`). No functionality is broken: tool selections and color settings still propagate properly. Code that previously accessed e.g. `state.selectedTool` is updated to use the unified location, preventing state mismatches.",
      "dependencies": []
    },
    {
      "task_id": "P2-06",
      "description": "Implement basic viewport culling to skip rendering off-screen canvas elements",
      "target_files": [
        {
          "path": "src/features/canvas/renderer/modules/StickyNoteModule.ts",
          "line_range": "192-205",
          "function_name": "StickyNoteModule.reconcile"
        },
        {
          "path": "src/features/canvas/renderer/modules/ShapeRenderer.ts",
          "line_range": "similar loop",
          "function_name": "ShapeRenderer.reconcile"
        },
        {
          "path": "src/features/canvas/renderer/modules/ImageRendererAdapter.ts",
          "line_range": "similar loop",
          "function_name": "ImageRendererAdapter.reconcile"
        },
        {
          "path": "src/features/canvas/renderer/modules/DrawingRenderer.ts",
          "line_range": "88-100",
          "function_name": "DrawingRenderer.reconcile"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "for \\(const \\[id, sticky\\] of stickyNotes\\) \\{",
          "replace_with": "const viewport = ctx.store.getState().viewport;\\n       const viewRect = { x: viewport.x, y: viewport.y, width: window.innerWidth / viewport.scale, height: window.innerHeight / viewport.scale };\\n       for (const [id, sticky] of stickyNotes) {\\n         // Cull off-screen sticky notes\\n         if (sticky.x + sticky.width < viewRect.x || sticky.y + sticky.height < viewRect.y || sticky.x > viewRect.x + viewRect.width || sticky.y > viewRect.y + viewRect.height) {\\n           continue;  // skip rendering this sticky note if outside viewport\\n         }",
          "line_number": "193"
        },
        {
          "operation": "insert",
          "find_pattern": "for \\(const \\[id, element\\] of elements.entries\\(\\)\\) \\{",
          "replace_with": "const viewport = store.getState().viewport;\\n    const viewBounds = { minX: viewport.x, minY: viewport.y, maxX: viewport.x + window.innerWidth / viewport.scale, maxY: viewport.y + window.innerHeight / viewport.scale };\\n    for (const [id, element] of elements.entries()) {\\n      const b = getElementBounds(element);\\n      if (b && (b.x + b.width < viewBounds.minX || b.y + b.height < viewBounds.minY || b.x > viewBounds.maxX || b.y > viewBounds.maxY)) {\\n        continue; // skip off-screen element\\n      }",
          "line_number": "51"
        }
      ],
      "validation_steps": [
        "Manual test: Create many elements (sticky notes, shapes, drawings) and then pan/zoom the canvas so some are far outside the view. Open the browser devtools Performance monitor and record while panning. Verify that rendering work (Konva node additions/updates) is reduced when many elements are off-screen (frame rate should remain high, and no unnecessary DOM nodes for off-screen items).",
        "Manual test: Ensure that when off-screen elements come back into view (by panning back or zooming out), they render correctly again (no permanent disappearance).",
        "Unit test (if possible): Simulate a store with viewport and a set of element bounds, call reconcile, and assert that elements outside the viewport do not produce Konva nodes (this may require instrumenting the renderer modules or checking the count of nodes after reconciliation)."
      ],
      "success_criteria": "Canvas rendering skips elements that are entirely outside the current viewport, improving performance for large scenes. Scrolling or zooming such that elements enter the viewport triggers their rendering. This culling does not visibly alter any in-view content (all elements in the view are still rendered correctly) but yields higher frame rates and less CPU usage when many elements are off-screen.",
      "dependencies": []
    },
    {
      "task_id": "P2-07",
      "description": "Integrate a global RafBatcher for coordinated frame updates across tools",
      "target_files": [
        {
          "path": "src/features/canvas/components/FigJamCanvas.tsx",
          "line_range": "99-107",
          "function_name": "FigJamCanvas component (top level consts)"
        },
        {
          "path": "src/features/canvas/components/tools/navigation/PanTool.tsx",
          "line_range": "97-106",
          "function_name": "handlePointerMove"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/PenTool.tsx",
          "line_range": "143-152",
          "function_name": "onPointerMove"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "const stageRef = useRef<Konva.Stage \\| null>",
          "replace_with": "const rafBatcherRef = useRef(new RafBatcher());",
          "line_number": "44"
        },
        {
          "operation": "replace",
          "find_pattern": "cancelAnimationFrame\\(rafRef.current\\);",
          "replace_with": "rafRef.current && cancelAnimationFrame(rafRef.current);",
          "line_number": "97"
        },
        {
          "operation": "replace",
          "find_pattern": "rafRef.current = requestAnimationFrame",
          "replace_with": "rafRef.current = requestAnimationFrame",
          "line_number": "102"
        },
        {
          "operation": "replace",
          "find_pattern": "requestAnimationFrame\\(\\(\\) => \\{([^]*?)storeState.viewport\\.setPan",
          "replace_with": "rafBatcherRef.current.enqueueWrite(() => { $1 storeState.viewport.setPan",
          "line_number": "102"
        },
        {
          "operation": "replace",
          "find_pattern": "if \\(!rafPendingRef.current\\) \\{[^]*requestAnimationFrame",
          "replace_with": "if (!rafPendingRef.current) {\\n      rafPendingRef.current = true;\\n      rafBatcherRef.current.enqueueWrite(() => {",
          "line_number": "143"
        }
      ],
      "validation_steps": [
        "Manual test: Pan the canvas while simultaneously drawing a stroke (e.g., use two input methods or simulate via code). The updates for panning and drawing should appear smooth and in sync, with no dropped frames or tearing. The RafBatcher should batch these updates in the same frame when possible.",
        "Manual test: Zoom (mouse wheel) and pan concurrently if possible; confirm no race conditions or jitter – the viewport should update consistently.",
        "Run automated performance tests or use the browser's FPS meter: verify that high-frequency events (pan, draw) maintain ~60fps with the RafBatcher engaged. Logging (if enabled) of RafBatcher metrics might show combined operations in a single frame:contentReference[oaicite:6]{index=6}:contentReference[oaicite:7]{index=7}."
      ],
      "success_criteria": "All high-frequency canvas updates (panning, drawing tool moves, etc.) are coordinated via a single RafBatcher. This ensures that multiple updates within a frame are coalesced, avoiding redundant renders. The user experience remains smooth even under concurrent interactions, and the internal metrics (if collected) show reduced redundant layer draws. No functionality changes except improved performance and consistency of updates.",
      "dependencies": []
    },
    {
      "task_id": "P2-08",
      "description": "Implement stroke decimation to reduce points in freehand drawing tools for performance",
      "target_files": [
        {
          "path": "src/features/canvas/utils/pointer.ts",
          "line_range": "0-0",
          "function_name": "getWorldPointer (or new util for distance)"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/PenTool.tsx",
          "line_range": "138-147",
          "function_name": "onPointerMove"
        },
        {
          "path": "src/features/canvas/components/tools/drawing/HighlighterTool.tsx",
          "line_range": "136-144",
          "function_name": "onPointerMove"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "// ... existing pointer logic",
          "replace_with": "let lastPos = { x: 0, y: 0 };\\nfunction shouldAddPoint(newX: number, newY: number) {\\n  const dx = newX - lastPos.x;\\n  const dy = newY - lastPos.y;\\n  return dx * dx + dy * dy > 4; // only add if moved > ~2px\\n}",
          "line_number": "1"
        },
        {
          "operation": "replace",
          "find_pattern": "pointsRef.current.push\\(pos.x, pos.y\\);",
          "replace_with": "if (shouldAddPoint(pos.x, pos.y)) {\\n         pointsRef.current.push(pos.x, pos.y);\\n         lastPos = pos;\\n       }",
          "line_number": "142"
        }
      ],
      "validation_steps": [
        "Manual test: Draw a long continuous stroke with the pen or highlighter. Visually it should appear the same as before. Check the stored points array length for the stroke (e.g., via console logging or devtools on the CanvasElement). It should contain significantly fewer points than before (depending on speed of drawing, adjacent points closer than ~2px apart are now dropped).",
        "Manual test: Draw slow versus fast strokes. Ensure that slow, detailed drawings still capture intended detail (since points will be spaced under the threshold, they will all record). Fast strokes should have fewer points but still follow the path closely with no noticeable straight-line segments or missed turns.",
        "Performance test: Create a very large scribble covering the canvas. Confirm that memory usage and CPU time for adding the element are reduced (no lag on commit), and undo/redo of that stroke is quicker due to fewer points. There should be no crashes or performance degradation with decimation on."
      ],
      "success_criteria": "Freehand drawing tools now drop points that are extremely close together, reducing the complexity of saved strokes without visibly affecting the stroke quality. Large or fast strokes consume less memory and render faster. The decimation algorithm is conservative enough not to affect normal drawing detail (users do not notice any points missing in their strokes), but it prevents excessive point density in long, fast scribbles.",
      "dependencies": []
    },
    {
      "task_id": "P2-09",
      "description": "Refactor store CoreModule to remove explicit `any` types using typed immer drafts",
      "target_files": [
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "419-429",
          "function_name": "updateElement (beforeOriginal capture)"
        },
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "537-548",
          "function_name": "removeElement (immer set draft)"
        },
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "626-635",
          "function_name": "removeElements (immer set draft)"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "export interface ElementModuleSlice",
          "replace_with": "import type { WritableDraft } from 'immer';",
          "line_number": "1"
        },
        {
          "operation": "replace",
          "find_pattern": "set\\(\\(state\\) => \\{",
          "replace_with": "set((state: WritableDraft<ElementModuleSlice & SelectionModuleSlice & HistorySlice>) => {",
          "line_number": "536"
        },
        {
          "operation": "replace",
          "find_pattern": "\\(state as any\\)\\.selectedElementIds",
          "replace_with": "state.selectedElementIds",
          "line_number": "560"
        },
        {
          "operation": "replace",
          "find_pattern": "\\(state as any\\)\\.elements",
          "replace_with": "state.elements",
          "line_number": "538"
        },
        {
          "operation": "replace",
          "find_pattern": "const root = get\\(\\) as any;",
          "replace_with": "const root = get(); // type as UnifiedCanvasStore (inferred)",
          "line_number": "586"
        }
      ],
      "validation_steps": [
        "Run `npm run type-check`. The coreModule.ts file should now produce 0 TypeScript errors and significantly fewer ESLint warnings (no `@typescript-eslint/no-explicit-any` warnings in this module).",
        "Open coreModule.ts in an editor/IDE and verify that properties like `state.elements`, `state.selectedElementIds` are now recognized by intellisense without casts. The code should compile without `as any` in these sections:contentReference[oaicite:8]{index=8}:contentReference[oaicite:9]{index=9}.",
        "Run unit tests covering element addition/deletion/updates. All should pass, confirming that behavior remains identical after the type refinement (the refactor should not change runtime logic).",
        "Perform a quick manual test in the app: add elements, delete elements, undo/redo, to ensure these core actions still function correctly (to catch any subtle mistakes in refactoring)."
      ],
      "success_criteria": "The core store module is now fully type-safe. All previously casted accesses (elements, elementOrder, selection sets, etc.) use proper types, eliminating the bulk of `any` usages. ESLint warnings for `no-explicit-any` in coreModule are resolved (reduced by ~130+ warnings):contentReference[oaicite:10]{index=10}. The application’s behavior (element creation, updates, deletion, history) remains correct and unchanged, indicating the refactoring did not introduce regressions.",
      "dependencies": []
    },
    {
      "task_id": "P2-10",
      "description": "Remove remaining ts-ignore/ts-expect-error comments by addressing their causes",
      "target_files": [
        {
          "path": "src/features/canvas/hooks/useKeyboardShortcuts.ts",
          "line_range": "19-27",
          "function_name": "isMacPlatform"
        },
        {
          "path": "src/features/canvas/hooks/useKeyboardShortcuts.ts",
          "line_range": "22-26",
          "function_name": "isMacPlatform (ts-expect-error)"
        },
        {
          "path": "src/types/global.d.ts",
          "line_range": "1-6",
          "function_name": "(new file for global types)"
        }
      ],
      "code_changes": [
        {
          "operation": "delete",
          "find_pattern": "// @ts-expect-error - userAgentData may not be available in all browsers",
          "replace_with": "",
          "line_number": "22"
        },
        {
          "operation": "replace",
          "find_pattern": "const uaData = navigator.userAgentData\\?\\.platform ?? '';",
          "replace_with": "const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '';",
          "line_number": "23"
        },
        {
          "operation": "insert",
          "find_pattern": "}",
          "replace_with": "declare global {\\n  interface Navigator {\\n    userAgentData?: { platform?: string };\\n  }\\n}",
          "line_number": "0"
        }
      ],
      "validation_steps": [
        "Run `npm run lint`. There should be no lint errors about banned TS comments (we've removed the one instance and handled its cause).",
        "Verify that `navigator.userAgentData` usage is now properly typed and does not cause TypeScript errors. The `isMacPlatform` function should compile without ignoring errors, and still correctly detect Mac vs non-Mac.",
        "Manual test: on a platform with userAgentData (e.g., modern Chrome on Windows/Mac), ensure the keyboard shortcuts still apply the correct meta key behavior (e.g., on Mac, Command+Z triggers undo, on Windows Ctrl+Z triggers undo). This ensures our change to navigator typing did not break the logic."
      ],
      "success_criteria": "All TypeScript suppression comments (ts-ignore/expect-error) have been removed from the codebase. In the specific case of navigator.userAgentData, the code is now properly typed via an interface extension (or safe casting) and continues to function correctly. Lint rules will now enforce that no ignored errors remain in the code.",
      "dependencies": []
    },
    {
      "task_id": "P2-11",
      "description": "Enable ESLint rule to ban TypeScript directive comments and ensure none remain",
      "target_files": [
        {
          "path": ".eslintrc.cjs",
          "line_range": "39-48",
          "function_name": "ESLint rules configuration"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "'@typescript-eslint/no-non-null-assertion': 'warn',",
          "replace_with": "'@typescript-eslint/no-non-null-assertion': 'warn',\\n    '@typescript-eslint/ban-ts-comment': 'error',",
          "line_number": "43"
        }
      ],
      "validation_steps": [
        "Introduce a fake ts-ignore comment in a file (for testing) and run `npm run lint`. ESLint should report an error on that comment, confirming the rule is active.",
        "Run `npm run lint` on the whole codebase. It should pass without errors now (since we removed the prior ts-expect-error).",
        "Code review: Ensure that the `.eslintrc.cjs` now contains the ban-ts-comment rule set to 'error'. Future attempts to add ts-ignore comments will surface in CI."
      ],
      "success_criteria": "The ESLint configuration now disallows `// @ts-` comments in the code. The codebase is free of such comments (validated in task P2-10), and this rule will prevent new suppressed errors from being introduced, maintaining codebase transparency and type safety. The lint step fails if any developer tries to add a ts-ignore in the future.",
      "dependencies": ["P2-10"]
    },
    {
      "task_id": "P2-12",
      "description": "Enforce consistent type-only imports in codebase",
      "target_files": [
        {
          "path": ".eslintrc.cjs",
          "line_range": "39-48",
          "function_name": "ESLint rules configuration"
        },
        {
          "path": "src/features/canvas/stores/unifiedCanvasStore.ts",
          "line_range": "11-18",
          "function_name": "(import declarations)"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "'@typescript-eslint/no-non-null-assertion': 'warn',",
          "replace_with": "'@typescript-eslint/no-non-null-assertion': 'warn',\\n    '@typescript-eslint/consistent-type-imports': 'error',",
          "line_number": "43"
        },
        {
          "operation": "replace",
          "find_pattern": "import type \\{ CoreModuleSlice \\} from './modules/coreModule';",
          "replace_with": "import type { CoreModuleSlice, HistoryModuleSlice, InteractionModuleSlice } from './modules/coreModule';",
          "line_number": "7"
        }
      ],
      "validation_steps": [
        "Run `npm run lint`. The linter should flag any import that is only used as a type if it is not using the `import type` syntax. Use `eslint --fix` to automatically convert these imports. After running fix, `npm run lint` should report 0 errors for type-imports.",
        "Inspect a few key files (especially those with many imports of types, e.g., store modules and renderer modules) to ensure that type-only imports are indeed prefixed with `import type`. For example, unifiedCanvasStore.ts imports of interfaces should use `import type` syntax where appropriate:contentReference[oaicite:11]{index=11}.",
        "Run `npm run build` to ensure that separating type imports did not affect the build (should be no change in runtime behavior)."
      ],
      "success_criteria": "All TypeScript imports that are only used for typing are now declared with `import type`. The ESLint rule is enabled to enforce this consistently. The change is purely compile-time and does not affect runtime, but it improves clarity and possibly build performance. The code passes lint checks for consistent type imports, preventing mixing type-only and value imports improperly.",
      "dependencies": []
    },
    {
      "task_id": "P2-13",
      "description": "Enable prefer-readonly rule and apply it to immutable data structures",
      "target_files": [
        {
          "path": ".eslintrc.cjs",
          "line_range": "39-48",
          "function_name": "ESLint rules configuration"
        },
        {
          "path": "types/index.ts",
          "line_range": "3-14",
          "function_name": "CanvasElement interface"
        },
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "663-672",
          "function_name": "duplicateElement"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "'@typescript-eslint/consistent-type-imports': 'error',",
          "replace_with": "'@typescript-eslint/consistent-type-imports': 'error',\\n    '@typescript-eslint/prefer-readonly': 'warn',",
          "line_number": "44"
        },
        {
          "operation": "replace",
          "find_pattern": "id: ElementId;",
          "replace_with": "readonly id: ElementId;",
          "line_number": "3"
        },
        {
          "operation": "replace",
          "find_pattern": "type:\\s*\\| \"rectangle\"",
          "replace_with": "readonly type: \\n    | \"rectangle\"",
          "line_number": "5"
        },
        {
          "operation": "replace",
          "find_pattern": "clone.id = newId;",
          "replace_with": "// Construct clone with new ID to satisfy readonly id\\n    const clonedElement = { ...el, id: newId } as CanvasElement;",
          "line_number": "665"
        }
      ],
      "validation_steps": [
        "Run `npm run lint`. There should be no errors; the prefer-readonly rule might emit warnings if there are still opportunities to add readonly (which we can address iteratively). Ensure no critical violation is present.",
        "Check that `CanvasElement.id` and `CanvasElement.type` are now readonly in the type definitions:contentReference[oaicite:12]{index=12}. Verify that code still compiles: in particular, the `duplicateElement` logic was adjusted to not mutate `id` after creation (it now creates a new object with the new id). Run `npm run type-check` to ensure no type errors were introduced.",
        "Run unit tests for duplicate element and other store operations. For example, duplicating an element should still work (creating a new element with a different ID). The change in implementation (constructing clonedElement) should not change behavior. Undo/redo for duplicate should still function correctly.",
        "Manual test: In the app, use any 'duplicate' feature (if exposed in UI, e.g., Ctrl+D on a selected shape). Confirm the element duplicates as expected. Also create an element and verify its `id` and `type` are not altered unexpectedly afterward (they should remain constant)."
      ],
      "success_criteria": "The codebase is moving toward greater immutability guarantees. The ESLint prefer-readonly rule is enabled (as a warning for now), and key invariants are enforced in types. For example, element IDs and types are readonly, reflecting that these should never change once an element is created. Code that legitimately needed to set these (like duplication) has been refactored to avoid directly mutating readonly properties. All tests and functionality pass, indicating no regression. Future code will be encouraged (via warnings) to use readonly where applicable, improving reliability.",
      "dependencies": []
    },
    {
      "task_id": "P2-14",
      "description": "Increase unit test coverage for store logic (actions and reducers)",
      "target_files": [
        {
          "path": "src/features/canvas/stores/__tests__/coreModule.test.ts",
          "line_range": "1-100",
          "function_name": "(new test file)"
        },
        {
          "path": "src/features/canvas/stores/modules/coreModule.ts",
          "line_range": "0-0",
          "function_name": "CoreModule (subject under test)"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "",
          "replace_with": "import { create } from 'zustand';\\nimport { createCoreModule } from '../modules/coreModule';\\nimport { createHistoryModule } from '../modules/historyModule';\\nimport { createInteractionModule } from '../modules/interactionModule';\\n\\ndescribe('UnifiedCanvasStore CoreModule', () => {\\n  let useStore: ReturnType<typeof create>;<br>  beforeEach(() => {<br>    // Create a fresh store for each test<br>    useStore = create((set, get) => ({<br>      ...createHistoryModule(set, get),<br>      ...createCoreModule(set, get),<br>      ...createInteractionModule(set, get),<br>    }));<br>  });\\n  test('adds and retrieves an element', () => {<br>    const id = useStore.getState().element.upsert({ id: 'test1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 });<br>    const el = useStore.getState().element.getById(id);<br>    expect(el).toBeDefined();<br>    expect(el?.id).toBe('test1');<br>    expect(el?.type).toBe('rectangle');<br>    expect(useStore.getState().elements.has(id)).toBe(true);<br>  });\\n  test('deleteSelected removes all selected elements', () => {<br>    const id1 = useStore.getState().element.upsert({ id: 'test2', type: 'rectangle', x: 0, y: 0 });<br>    const id2 = useStore.getState().element.upsert({ id: 'test3', type: 'ellipse', x: 5, y: 5 });<br>    useStore.getState().selection.set([id1, id2]);<br>    useStore.getState().selection.deleteSelected();<br>    expect(useStore.getState().elements.size).toBe(0);<br>    expect(useStore.getState().selectedElementIds.size).toBe(0);<br>    // Undo should restore both elements:<br>    useStore.getState().history.undo();<br>    expect(useStore.getState().elements.size).toBe(2);<br>    expect(useStore.getState().elements.get(id1)).toBeDefined();<br>  });\\n  // ... more tests for duplicate, bringToFront, etc.<br>});",
          "line_number": "1"
        }
      ],
      "validation_steps": [
        "Run `npm run test:unit`. The new test suite for coreModule should run and pass all cases. Ensure coverage reports indicate an increase in store-related coverage (aim for coreModule functions to be mostly covered by these tests).",
        "Observe that tests cover: adding elements, selecting and deleting elements (including multi-delete), duplicating elements, ordering (bringToFront/sendToBack), and history integration (undo/redo around these actions). If any scenario fails, adjust implementation or tests accordingly. For example, the test above checks that undo after deleteSelected restores elements, validating our atomic deletion implementation.",
        "Review the test code to confirm it does not rely on any UI or Konva, just the Zustand store logic. The store is initialized in isolation, which is correct for unit testing the business logic."
      ],
      "success_criteria": "Key store operations are now validated by automated unit tests. We have high confidence that element CRUD, selection management, and history integration work as intended (and will catch future regressions quickly). The test coverage for the store modules has increased (no critical store function remains untested). This safety net will support ongoing refactoring and feature additions.",
      "dependencies": []
    },
    {
      "task_id": "P2-15",
      "description": "Add integration tests for selection, transformation, and undo/redo flows",
      "target_files": [
        {
          "path": "src/features/canvas/__tests__/canvasIntegration.test.tsx",
          "line_range": "1-120",
          "function_name": "(new integration test file)"
        },
        {
          "path": "src/features/canvas/components/FigJamCanvas.tsx",
          "line_range": "234-243",
          "function_name": "(stage click handler reference)"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "",
          "replace_with": "import { render, fireEvent } from '@testing-library/react';\\nimport FigJamCanvas from '../components/FigJamCanvas';\\n\\ntest('Selecting and transforming an element updates store and UI correctly', () => {\\n  const { getByTestId } = render(<FigJamCanvas />);\\n  // Create a shape via store (simulate a user action)\\n  const store = (window as any).useUnifiedCanvasStore;\\n  const id = store.getState().element.upsert({ id: 'shape1', type: 'rectangle', x: 50, y: 50, width: 20, height: 20 });\\n  // Simulate user clicking the shape on the canvas\\n  const stage = getByTestId('konva-stage');\\n  fireEvent.pointerDown(stage, { clientX: 55, clientY: 55 });\\n  fireEvent.pointerUp(stage);\\n  expect(store.getState().selectedElementIds.has(id)).toBe(true);\\n  // Simulate a transform (e.g., dragging a corner)\\n  const node = store.getState().elements.get(id);\\n  expect(node).toBeDefined();\\n  store.getState().selection.beginTransform();\\n  store.getState().element.update(id, { width: 40, height: 40 });\\n  store.getState().selection.endTransform();\\n  const updated = store.getState().elements.get(id);\\n  expect(updated?.width).toBe(40);\\n  // Undo the transform\\n  store.getState().history.undo();\\n  const reverted = store.getState().elements.get(id);\\n  expect(reverted?.width).toBe(20);\\n});",
          "line_number": "1"
        }
      ],
      "validation_steps": [
        "Run `npm run test` (or specifically this new test). It should simulate clicking on an element and transforming it, then undoing, all in a headless test environment. The test should pass, indicating that selection state and history behave as expected in concert.",
        "Consider edge cases: selection of multiple elements (simulate marquee selection by firing pointer down/move/up on empty canvas area), deletion via keyboard events, etc., and extend the integration test as needed. Ensure all such tests pass.",
        "Run the full test suite to make sure nothing else broke. Integration tests may be a bit brittle due to reliance on actual component rendering; adjust selectors (e.g., use data-testid on Konva stage container as shown) to reliably target elements."
      ],
      "success_criteria": "Integration tests confirm that high-level interactions work as a whole: selecting an element via the canvas, performing a transform, and using undo/redo all update the state appropriately and maintain consistency. The test uses the actual React component and store together, catching any issues in the interaction between them (e.g., ensuring that the SelectionModule and store remain in sync). These tests will guard against future regression in selection or transformation logic, which were areas of known issues.",
      "dependencies": []
    },
    {
      "task_id": "P2-16",
      "description": "Add end-to-end (E2E) tests for critical user workflows",
      "target_files": [
        {
          "path": "e2e/canvas.spec.ts",
          "line_range": "1-60",
          "function_name": "(new Playwright or Cypress test spec)"
        }
      ],
      "code_changes": [
        {
          "operation": "insert",
          "find_pattern": "",
          "replace_with": "import { test, expect } from '@playwright/test';\\n\\ntest('User can draw, select, move, and undo on the canvas', async ({ page }) => {\\n  await page.goto('http://localhost:1421/');\\n  // Draw a stroke\\n  await page.click('button[aria-label=\"Pen Tool\"]');\\n  const canvas = page.locator('canvas');\\n  const bbox = await canvas.boundingBox();\\n  if (bbox) {\\n    // simulate a drawing drag on canvas\\n    await page.mouse.move(bbox.x + 100, bbox.y + 100);\\n    await page.mouse.down();\\n    await page.mouse.move(bbox.x + 150, bbox.y + 150);\\n    await page.mouse.up();\\n  }\\n  // Switch to select tool and click the drawn stroke\\n  await page.click('button[aria-label=\"Select Tool\"]');\\n  await page.mouse.click(bbox.x + 140, bbox.y + 140);\\n  // Verify selection frame appears (e.g., transformer visible)\\n  const transformer = await canvas.evaluate((c) => document.querySelector('div.transformer'));\\n  expect(transformer).not.toBeNull();\\n  // Press Delete key to remove the stroke\\n  await page.keyboard.press('Delete');\\n  // Undo the deletion\\n  await page.keyboard.press('Control+Z');\\n  // Expect the stroke to reappear (maybe check canvas pixels or element count)\\n  const elementsCount = await page.evaluate(() => window.useUnifiedCanvasStore.getState().elements.size);\\n  expect(elementsCount).toBe(1);\\n});",
          "line_number": "1"
        }
      ],
      "validation_steps": [
        "Run the E2E tests with the chosen framework (e.g., `npx playwright test` or `npm run cy:run`). The test should open the app, simulate tool clicks and canvas interactions, and pass all assertions. Specifically, it should confirm that drawing works, selection appears, deletion and undo function correctly from the user's perspective.",
        "Review the test output or any screenshots on failure. If something is not working (e.g., the way we detect the selection frame), adjust the test or app instrumentation (e.g., ensure there's a way to identify the transformer on the page, perhaps by adding a `data-testid`).",
        "Extend E2E tests to cover other key flows if time permits: e.g., sticky note creation (click Sticky Note tool, verify text editor pops up), connector drawing between two shapes, resizing a shape with shift key, etc. These scenarios can catch integration issues that unit tests might miss."
      ],
      "success_criteria": "High-level user workflows are now verified in an automated fashion. The end-to-end tests simulate actual user behavior in the application UI and confirm the expected outcomes (visual or via state). We have confidence that core interactions (drawing, selecting, deleting, undoing, etc.) work from the user's standpoint. These tests will guard against any future breaking changes in event wiring, tool state management, or other regressions that only manifest when the app is running in full.",
      "dependencies": []
    },
    {
      "task_id": "P2-17",
      "description": "Update documentation to reflect Phase 2 changes and current architecture",
      "target_files": [
        {
          "path": "docs/architecture/README.md",
          "line_range": "271-280",
          "function_name": "Layering Model – Four-Layer Pipeline"
        },
        {
          "path": "docs/CHANGELOG.md",
          "line_range": "0-0",
          "function_name": "Unreleased (upcoming changes)"
        },
        {
          "path": "docs/known-issues.md",
          "line_range": "220-230",
          "function_name": "Known issues around selection (if resolved)"
        }
      ],
      "code_changes": [
        {
          "operation": "replace",
          "find_pattern": "├── Main Layer       (Committed elements)",
          "replace_with": "├── Main Layer       (Committed elements, incl. highlighter strokes at bottom)",
          "line_number": "283"
        },
        {
          "operation": "replace",
          "find_pattern": "├── Preview Layer    (Temp drawing, ghosts)",
          "replace_with": "├── Preview Layer    (Temp drawings, ghosts – no direct commits)",
          "line_number": "279"
        },
        {
          "operation": "replace",
          "find_pattern": "Four-layer Konva Pipeline \\(VANILLA - NO react-konva\\)",
          "replace_with": "Four-layer Konva Pipeline (post-Phase1 & Phase2 compliance)",
          "line_number": "27"
        },
        {
          "operation": "insert",
          "find_pattern": "## [Unreleased]",
          "replace_with": "## [Unreleased]\\n### Architecture Remediation Phase 2 - Further Alignments (Date TBD)\\n- **Changed**: Reverted to four Konva layers by merging highlighter into main layer (highlighter strokes now drawn in main layer behind other content):contentReference[oaicite:13]{index=13}.\\n- **Improved**: All drawing tools now use store-driven rendering exclusively; removed direct Konva node moves (fixes potential duplication issues).\\n- **Improved**: Multi-delete is atomic in history (undoing a delete restores all elements at once).\\n- **Performance**: Added viewport culling for off-screen elements and centralized RAF batching for smoother interactions.\\n- **Code Quality**: Removed all `any` casts from store modules, enabled stricter lint rules (`ban-ts-comment`, `consistent-type-imports`, `prefer-readonly`).\\n- **Testing**: Increased test coverage for store logic; added integration and E2E tests for critical user flows.\\n",
          "line_number": "7"
        }
      ],
      "validation_steps": [
        "Open the updated `docs/architecture/README.md` and read the Layering Model and pipeline sections. It should correctly describe the four layers and note that highlighter content is within the main layer group (so there's no confusion about a fifth layer). The documentation should align with the actual implementation now:contentReference[oaicite:14]{index=14}.",
        "Check `docs/known-issues.md`: any items resolved by Phase 2 (such as the selection system being broken, or the infinite loop issues) should be marked resolved or removed if appropriate. Update or remove entries like \"sticky note selection COMPLETELY BROKEN\" if that has been fixed by our changes (or at least rephrase to reflect current status).",
        "Review `docs/CHANGELOG.md`: The Unreleased section should clearly list the Phase 2 changes. Ensure that each major change from the tasks above is summarized, so that future developers/users can see what was done in this batch of work. After Phase 2 is released, this would be moved under a version number."
      ],
      "success_criteria": "Project documentation accurately reflects the post-Phase2 architecture and behavior. The official architecture README now matches the implemented system (e.g., exactly four layers, store-driven rendering for tools, etc.). The changelog outlines all Phase 2 remediation changes for transparency. Any previously documented issues that have been addressed are updated, preventing confusion for readers about the current state of the project. Overall, documentation and code are once again in sync with the master blueprint.",
      "dependencies": []
    }
  ],
  "execution_order": [
    "P2-01",
    "P2-02",
    "P2-03",
    "P2-04",
    "P2-05",
    "P2-06",
    "P2-07",
    "P2-08",
    "P2-09",
    "P2-10",
    "P2-11",
    "P2-12",
    "P2-13",
    "P2-14",
    "P2-15",
    "P2-16",
    "P2-17"
  ],
  "critical_warnings": [
    "Merging the highlighter layer into the main layer (task P2-01) could affect selection and ordering. We must ensure highlighter strokes remain non-interactive and always behind other elements. Thorough testing is required to confirm that selection tools and the Transformer do not accidentally pick highlighter strokes, and that highlight rendering order is correct (especially if multiple highlights overlap).",
    "Changing drawing tool commit logic (task P2-02) removes a direct visual placement; if not done carefully, users might momentarily not see a stroke at commit time. We must verify no visual regressions (no flicker or missing strokes) and that undo still recognizes these strokes. The new approach relies on the DrawingRenderer – any bug there could result in strokes not appearing or being duplicated.",
    "Unifying the UI slice (task P2-05) removes duplicated state properties. If any component or function was still using the old properties (e.g., `selectedTool` at root), it will break. We need to update all references to use the new unified `state.ui` structure. Missing one could cause tools not to activate or colors not to apply, so this must be carefully audited.",
    "Viewport culling (task P2-06) introduces conditional skipping of rendering. If the bounds calculation or re-render triggers are off, some elements might not render when they should (e.g., if an element is just at the edge or if we don't re-trigger rendering on viewport changes for those elements). There's a risk that elements remain invisible after panning back into view. We'll need to ensure that any such element will get rendered (perhaps by forcing a reconcile on viewport change or using the existing subscription patterns). Thorough testing of panning/zooming edge cases is necessary.",
    "Integrating a global RafBatcher (task P2-07) changes how frame updates are scheduled. If not integrated correctly, it could cause either missed updates (if we accidentally drop some callback) or double updates. We removed direct `requestAnimationFrame` calls in favor of batcher scheduling; if the RafBatcher is misused, we could see either sluggish updates or, conversely, the batcher flooding frames. We should closely monitor the pan and draw behavior after this change to catch any timing issues.",
    "Marking certain fields as readonly (task P2-13, e.g., element id/type) can reveal assumptions in code. For instance, our duplicateElement code had to change to avoid directly assigning to `id`. If there are other places where code tried to mutate these fields (shouldn't be many), those will now be type errors or broken at runtime. We addressed the known case, but it's a point of caution: the readonly rule might cause compile failures if we missed something, and in a few cases we may need to adjust logic (like constructing new objects rather than mutating).",
    "Enabling stricter lint rules (tasks P2-11, P2-12, P2-13) could potentially break the build if not all violations are fixed. We must run lint and type-check as part of CI to catch any remaining issues. For example, after enabling prefer-readonly, we should verify the code (particularly in tests and less obvious modules) doesn't have easy-to-fix readonly improvements that we neglected, to avoid a flood of warnings or errors.",
    "The extensive refactoring of coreModule and historyModule types (task P2-09) needs to be tested thoroughly. Since we changed many casted references to typed ones, there's a small risk of runtime differences (though in theory it should be a pure type change). We should especially test undo/redo and selection after these changes to ensure no logic was accidentally altered (e.g., if a draft state was not handled as expected).",
    "Any new tests (tasks P2-14, P2-15, P2-16) must be kept in sync with the application behavior. If the app behavior changes slightly (e.g., we change a data-testid or a default tool), the tests might start failing, which could block CI. We should maintain these tests alongside feature changes. Additionally, E2E tests are inherently timing-sensitive; false negatives can occur if the environment is slow. We'll need to make them robust (using appropriate waits or retries).",
    "Finally, documentation updates must be reviewed by the team. Any discrepancy between code and docs can mislead developers. Given we changed the layering model back to 4 layers, all team members must be aware to not introduce a 'fifth layer' concept again. The blueprint should be treated as the source of truth – our changes bring us closer to it, and any future deviation needs conscious decision-making."
  ]
}
