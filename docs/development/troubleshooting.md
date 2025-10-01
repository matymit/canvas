# Canvas Development Troubleshooting Guide

This guide covers common issues you might encounter during Canvas development and their solutions.

## Setup Issues

### Node.js and npm Issues

#### Problem: `npm install` fails with permission errors

**Symptoms**: EACCES errors, permission denied when installing packages
**Solution**:

```bash
# Fix npm permissions (Unix/macOS)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Alternative: Use npm's built-in fix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

#### Problem: Node version incompatibility

**Symptoms**: Package installation fails, build errors about unsupported Node version
**Solution**:

```bash
# Check current Node version
node --version

# Install Node 18+ using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Development Server Issues

#### Problem: `npm run dev` fails to start

**Symptoms**: Port already in use, Vite startup errors
**Solutions**:

```bash
# Check what's using the port
lsof -ti:5173
kill -9 <process-id>

# Or start on different port
npm run dev -- --port 3000

# Clear Vite cache if needed
rm -rf node_modules/.vite
npm run dev
```

#### Problem: Hot reload not working

**Symptoms**: Changes don't appear in browser, need manual refresh
**Solutions**:

- Check browser console for WebSocket connection errors
- Disable browser extensions that might interfere
- Try incognito/private browsing mode
- Restart the development server

### Tauri Desktop Development Issues

#### Problem: Rust toolchain not found

**Symptoms**: `cargo` command not found, Rust compiler errors
**Solution**:

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify installation
rustc --version
cargo --version
```

#### Problem: System dependencies missing (Linux)

**Symptoms**: Build errors about missing webkit2gtk, gtk3
**Solution**:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf groupinstall "C Development Tools and Libraries"
sudo dnf install webkit2gtk3-devel openssl-devel curl wget libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S webkit2gtk base-devel curl wget openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg libvips
```

#### Problem: Tauri app won't start in development

**Symptoms**: `npm run tauri:dev` builds but app doesn't open
**Solutions**:

- Check if antivirus is blocking the executable
- Run with verbose logging: `npm run tauri:dev -- --verbose`
- Clear Tauri cache: `rm -rf src-tauri/target`
- Check system permissions for unsigned executables

## Build and Compilation Issues

### TypeScript Compilation Errors

#### Problem: Type errors in canvas modules

**Symptoms**: Cannot find module errors, type mismatches
**Solutions**:

```bash
# Clean TypeScript cache
rm -rf tsconfig.tsbuildinfo
npx tsc --build --clean

# Regenerate type declarations
npm run type-check

# Check for circular imports
npm run build 2>&1 | grep -i "circular"
```

#### Problem: Missing type declarations

**Symptoms**: "Cannot find module" for internal modules
**Solutions**:

- Verify import paths are correct (use absolute paths from project root)
- Check `tsconfig.json` paths configuration
- Ensure all modules export their types properly

### Canvas-Specific Build Issues

#### Problem: Konva import errors

**Symptoms**: "konva not found", runtime errors about Konva methods
**Solutions**:

```typescript
// Correct import pattern
import Konva from "konva";

// NOT react-konva (not used in this project)
// import { Stage } from 'react-konva'; // ❌ Don't use this
```

#### Problem: Store subscription errors

**Symptoms**: Zustand subscription failures, state not updating
**Solutions**:

```typescript
// Ensure proper shallow comparison
import { shallow } from "zustand/shallow";

const store = useUnifiedCanvasStore(
  (state) => ({ elements: state.elements }),
  shallow, // Important for object/array comparisons
);
```

### Bundle Size Issues

#### Problem: Bundle too large

**Symptoms**: Build warnings about chunk size, slow loading
**Solutions**:

```bash
# Analyze bundle size
npm run build:analyze

# Check for large dependencies
npm run test:bundle-size

# Common large dependencies to check:
# - Konva (necessary but large)
# - Unneeded polyfills
# - Development utilities in production build
```

## Runtime Issues

### Canvas Rendering Problems

#### Problem: Canvas not displaying

**Symptoms**: Blank white canvas, no tools working
**Debugging Steps**:

1. Check browser console for JavaScript errors
2. Verify Konva stage is properly initialized
3. Check if container element exists and has dimensions
4. Ensure layers are properly configured

**Solutions**:

```typescript
// Verify container has dimensions
const container = document.getElementById("canvas-container");
console.log("Container:", container?.offsetWidth, container?.offsetHeight);

// Check stage initialization
console.log("Stage:", stage?.width(), stage?.height());

// Verify layer structure
stage?.children.forEach((layer, index) => {
  console.log(`Layer ${index}:`, layer.className, layer.children.length);
});
```

#### Problem: Double-click events not firing on specific element types

**Symptoms**: Double-clicking elements doesn't trigger expected behavior (e.g., can't edit text in mindmap nodes)
**Root Cause**: Stage-level event handlers intercepting events before they reach node-level handlers

**Understanding Konva Event Flow**:
```
Stage (highest priority)
  ↓
Layer
  ↓
Group
  ↓
Node (lowest priority)
```

**Common Scenario**: `MarqueeSelectionTool` or other stage-level tools capturing clicks on selected elements

**Debugging Steps**:

1. Check if stage-level handlers are preventing event bubbling
2. Verify `evt.cancelBubble` is not being set prematurely
3. Look for early `return` statements that bypass node handlers
4. Check if `isDragging` or similar flags are set too early

**Solution Pattern**:

```typescript
// In stage-level pointer handler (e.g., MarqueeSelectionTool)
const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
  const target = e.target;
  const elementId = target.getAttr("elementId") || target.id();
  const element = elements.get(elementId);
  
  // CRITICAL: Check for special element types that need custom interaction
  if (
    element?.type === "mindmap-node" || 
    target.getAttr("nodeType") === "mindmap-node"
  ) {
    // Don't intercept - let the element's renderer handle clicks/double-clicks
    return;
  }
  
  // Continue with stage-level handling for other elements
  startDragOrSelection();
};
```

**Example Fix (Mindmap Double-Click)**:
- **Issue**: Couldn't double-click mindmap nodes to edit text
- **Cause**: `MarqueeSelectionTool` set `isDragging=true` immediately on click
- **Fix**: Added type check to skip mindmap nodes (commit `62ee08e`)
- **Location**: `MarqueeSelectionTool.tsx` lines 244-253

**Prevention Checklist**:
- ✅ Identify elements that need custom interaction handling
- ✅ Add type checks in stage-level handlers before capturing events
- ✅ Document timing requirements (e.g., 250ms delays for double-click detection)
- ✅ Test both single-click and double-click behavior after changes
- ✅ Verify drag operations still work for other element types

**Related Documentation**:
- Konva Event Handling: https://konvajs.org/docs/events/Binding_Events.html
- Event Bubbling: https://konvajs.org/docs/events/Event_Bubbling.html

#### Problem: Tools not responding

**Symptoms**: Click events not working, no drawing/selection
**Debugging Steps**:

1. Check if event listeners are properly attached
2. Verify tool is properly registered in ToolManager
3. Check event propagation and preventDefault calls

**Solutions**:

```typescript
// Debug event handling
stage?.on("pointerdown", (e) => {
  console.log("Stage pointerdown:", e.target);
});

// Check active tool
const activeTool = useUnifiedCanvasStore.getState().ui.getActiveTool();
console.log("Active tool:", activeTool);
```

#### Problem: Performance issues (slow rendering)

**Symptoms**: Lag when drawing, poor frame rate, browser freezes
**Solutions**:

```typescript
// Monitor performance
const startTime = performance.now();
layer.batchDraw();
const endTime = performance.now();
console.log("Draw time:", endTime - startTime, "ms");

// Check node count
console.log(
  "Nodes per layer:",
  layers.main.children.length,
  layers.preview.children.length,
);

// Enable RAF batching
import { batchedRAF } from "@features/canvas/utils/performance/RafBatcher";

batchedRAF(() => {
  layer.batchDraw();
});
```

### State Management Issues

#### Problem: Store state not persisting

**Symptoms**: App state resets on page reload
**Solutions**:

- Check if Zustand persist middleware is properly configured
- Verify browser storage permissions
- Check for serialization errors with Map/Set objects

#### Problem: Undo/redo not working

**Symptoms**: History actions don't change canvas state
**Debugging**:

```typescript
// Check history state
const history = useUnifiedCanvasStore.getState().history.getHistory();
console.log("History:", history.past.length, history.future.length);

// Verify withUndo usage
store.history.withUndo("Test action", () => {
  console.log("Inside undo action");
  store.element.upsert(testElement);
});
```

#### Problem: Selection not working

**Symptoms**: Elements can't be selected, transformer not appearing
**Solutions**:

```typescript
// Debug selection state
const selected = useUnifiedCanvasStore.getState().selection.getSelectedIds();
console.log("Selected:", Array.from(selected));

// Check transformer attachment
const transformer = layers.overlay.findOne(".transformer");
console.log("Transformer nodes:", transformer?.nodes());
```

## Memory and Performance Issues

### Memory Leaks

#### Problem: Memory usage keeps increasing

**Symptoms**: Browser becomes slow over time, tab crashes
**Solutions**:

- Check for event listener cleanup in tool lifecycle
- Verify Konva nodes are properly destroyed
- Monitor component mount/unmount cycles

**Debugging**:

```javascript
// Monitor memory usage
console.log("Memory:", performance.memory?.usedJSHeapSize / 1024 / 1024, "MB");

// Check for detached DOM nodes
setInterval(() => {
  console.log("Stage children:", stage?.children.length);
  console.log("Total nodes:", stage?.find("*").length);
}, 5000);
```

### Performance Degradation

#### Problem: Slow drawing with many elements

**Symptoms**: Drawing becomes laggy with complex scenes
**Solutions**:

- Implement viewport culling
- Use shape caching for complex elements
- Reduce drawing frequency with RAF batching

```typescript
// Implement simple viewport culling
const isInViewport = (element: CanvasElement) => {
  const viewport = store.viewport.getViewport();
  return (
    element.x < viewport.x + window.innerWidth &&
    element.x + element.width > viewport.x &&
    element.y < viewport.y + window.innerHeight &&
    element.y + element.height > viewport.y
  );
};
```

## Known Issues and Workarounds

### Current Implementation Limitations

#### Issue: Connector tool incomplete

**Status**: In development
**Workaround**: Use basic line tool or wait for completion
**Tracking**: Line and arrow connectors partially implemented

#### Issue: Mindmap tool not fully functional

**Status**: Basic structure exists
**Workaround**: Use text and manual shape creation
**Tracking**: Node creation works, branching needs completion

#### Issue: Advanced selection features missing

**Status**: Basic selection works
**Workaround**: Use simple click selection
**Missing**: Marquee selection, multi-select with Ctrl/Cmd

### Browser-Specific Issues

#### Safari: Touch events not working properly

**Symptoms**: Drawing doesn't work on iPad/iPhone
**Workaround**:

```typescript
// Ensure proper touch event handling
stage.on("touchstart", (e) => {
  e.evt.preventDefault();
  // Handle as pointer event
});
```

#### Firefox: Performance slower than Chrome

**Symptoms**: Noticeable lag in complex scenes
**Workaround**: Use RAF batching more aggressively, reduce update frequency

#### Edge: Occasional rendering glitches

**Symptoms**: Canvas appears corrupted on some operations
**Workaround**: Force redraw after problematic operations

## Development Environment Issues

### Hot Module Replacement Issues

#### Problem: Canvas state lost on HMR

**Symptoms**: Canvas clears when code changes
**Solutions**:

- Use Zustand persist to maintain state across reloads
- Implement HMR-safe component patterns
- Consider disabling HMR for canvas-specific modules during development

### Testing Issues

#### Problem: Tests fail with Konva

**Symptoms**: Canvas-related tests throw errors
**Solutions**:

```javascript
// Mock Konva in test environment
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});

// src/test/setup.ts
import { vi } from "vitest";

// Mock Konva for tests
vi.mock("konva", () => ({
  default: {
    Stage: vi.fn(),
    Layer: vi.fn(),
    Rect: vi.fn(),
    // ... other Konva classes
  },
}));
```

## Debugging Tools and Techniques

### Browser DevTools

#### Canvas Performance Profiling

1. Open Chrome DevTools
2. Go to Performance tab
3. Start recording
4. Perform canvas operations
5. Stop recording and analyze frame timings

#### Memory Profiling

1. Open DevTools Memory tab
2. Take heap snapshots before/after operations
3. Look for detached DOM nodes
4. Check for object retention

### Console Debugging

#### Canvas State Debugging

```javascript
// Add to browser console for debugging
window.debugCanvas = {
  store: () => window.__UNIFIED_CANVAS_STORE__?.getState(),
  stage: () => window.__KONVA_STAGE__,
  layers: () => window.__CANVAS_LAYERS__,
  elements: () =>
    window.__UNIFIED_CANVAS_STORE__?.getState().element.getAllElements(),
  selected: () =>
    Array.from(
      window.__UNIFIED_CANVAS_STORE__?.getState().selection.getSelectedIds() ||
        [],
    ),
};

// Usage: debugCanvas.elements()
```

### Performance Monitoring

#### Frame Rate Monitoring

```typescript
let frameCount = 0;
let lastTime = performance.now();

function monitorFPS() {
  frameCount++;
  const now = performance.now();

  if (now - lastTime >= 1000) {
    console.log("FPS:", frameCount);
    frameCount = 0;
    lastTime = now;
  }

  requestAnimationFrame(monitorFPS);
}

monitorFPS();
```

## Getting Help

### Internal Resources

- Check `CLAUDE.md` for architectural guidance
- Review existing tool implementations for patterns
- Look at test files for usage examples

### External Resources

- [Konva.js Documentation](https://konvajs.org/docs/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Tauri Documentation](https://tauri.app/)
- [Vite Troubleshooting](https://vitejs.dev/guide/troubleshooting.html)

### Community Support

- Check GitHub issues for similar problems
- Search for Konva.js specific issues
- Look for Tauri desktop app problems

### Reporting Issues

When reporting issues, include:

1. **Environment**: OS, browser, Node.js version
2. **Steps to reproduce**: Detailed reproduction steps
3. **Expected vs actual behavior**
4. **Console errors**: Full error messages and stack traces
5. **Screenshots/videos**: For visual issues
6. **Performance data**: If performance-related

---

## Quick Reference: Common Commands

```bash
# Reset development environment
rm -rf node_modules package-lock.json
npm install
npm run dev

# Debug build issues
npm run type-check
npm run lint
npm run build

# Performance analysis
npm run build:analyze
npm run test:performance-budgets

# Clean slate development
npm run clean
npm install
npm run dev
```

Remember: Most canvas issues are related to event handling, state management, or Konva layer configuration. Start with these areas when debugging problems.
