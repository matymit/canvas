# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start development server
npm run dev

# Start Tauri development (desktop app)
npm run tauri:dev

# Run specific test files
npm test <file-path>

# Run all tests
npm test
```

### Build & Production
```bash
# Build for production
npm run build

# Build Tauri app for production
npm run tauri:build:production

# Analyze bundle size
npm run build:analyze
npm run test:bundle-size
```

### Quality Checks
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Performance tests
npm run test:performance-budgets

# Security audit
npm run audit:security
npm run audit:licenses
```

### Cleanup
```bash
# Clean build artifacts
npm run clean

# Clean and reinstall dependencies
npm run clean:deps
```

## Architecture

### Technology Stack
- **Framework**: React 18 with TypeScript
- **Canvas Engine**: Vanilla Konva (NOT react-konva) - Direct Konva instance management
- **State Management**: Zustand with Immer for immutability
- **Desktop**: Tauri v1/v2 compatibility
- **Build Tool**: Vite with performance optimizations

### Canvas Architecture

#### Four-Layer Pipeline
The canvas uses a strict four-layer architecture for performance:
1. **Background Layer** - Static content (grid, backgrounds)
2. **Main Layer** - Primary interactive elements
3. **Preview Layer** - Temporary drawing/preview states
4. **Overlay Layer** - UI elements, selections, transformers

#### Key Canvas Components
- **UnifiedCanvasStore** (`src/features/canvas/stores/unifiedCanvasStore.ts`) - Central Zustand store with modules:
  - ElementModule - Canvas element CRUD operations
  - SelectionModule - Selection state management
  - ViewportModule - Pan, zoom, viewport transformations
  - HistoryModule - Undo/redo with transaction batching
  - UIModule - Tool states and UI configuration

- **CanvasLayerManager** (`src/features/canvas/layers/CanvasLayerManager.ts`) - Enforces four-layer architecture
- **ProductionKonvaOptimizer** (`src/features/canvas/utils/performance/ProductionKonvaOptimizer.ts`) - Performance optimizations

#### Performance Optimizations
- **RAF Batching** - All canvas updates batched through RequestAnimationFrame
- **Static Layers** - Background/overlay layers have `listening: false`
- **Shape Caching** - Complex shapes cached with HiDPI support
- **Spatial Indexing** - QuadTree for efficient hit detection
- **Object Pooling** - KonvaNodePool for node reuse

### Module Structure
```
src/
├── features/canvas/
│   ├── stores/          # Zustand store modules
│   ├── renderer/        # Konva rendering modules
│   ├── hooks/           # React hooks for canvas operations
│   ├── components/      # UI components (toolbar, tools)
│   ├── utils/           # Utilities (performance, spatial, drawing)
│   ├── layers/          # Layer management
│   ├── tauri/           # Tauri-specific optimizations
│   └── plugins/         # Plugin architecture
```

## Important Patterns

### Direct Konva Manipulation
```typescript
// CORRECT: Direct Konva usage
import Konva from 'konva';
const stage = new Konva.Stage({ container: 'canvas' });

// WRONG: Never use react-konva
// import { Stage } from 'react-konva';
```

### Store Operations with History
```typescript
// Always use withUndo for user actions
const store = useUnifiedCanvasStore.getState();
store.history.withUndo('Add shape', () => {
  store.element.upsert(newElement);
});

// Access element by ID
const element = store.element.getById(elementId);

// Update element properties
store.element.update(elementId, { cells: updatedCells });
```

### Performance-Critical Updates
```typescript
// Use RAF batching for canvas updates
import { batchedRAF } from '@features/canvas/utils/performance/RafBatcher';
batchedRAF(() => {
  layer.batchDraw();
});
```

## Performance Budgets

The application enforces strict performance budgets:
- **FCP**: ≤ 1.5s
- **TTI**: ≤ 3s
- **FPS**: ≥ 60fps
- **Memory**: ≤ 500MB peak
- **Bundle Size**: ≤ 4MB total
- **Canvas Layers**: ≤ 4 layers
- **Nodes per Layer**: ≤ 1000

## Testing Strategy

### Unit Tests
- Store modules: `src/features/canvas/__tests__/unit/*.test.ts`
- Isolated component logic testing

### E2E Tests
- Canvas interactions: `src/features/canvas/__tests__/e2e/*.test.ts`
- Performance budget validation
- Visual regression testing

### Performance Tests
- Budget validation: `npm run test:performance-budgets`
- Bundle size checks: `npm run test:bundle-size`

## Tauri Integration

### Configuration Files
- **v1**: `src-tauri/tauri.conf.json` - Production security settings
- **v2**: `src-tauri/Cargo.toml` - Capability-based permissions

### Platform Targets
- **Windows**: NSIS/MSI installers
- **macOS**: DMG with notarization support
- **Linux**: DEB/RPM/AppImage packages

### Security
- Strict CSP without unsafe-inline/eval
- Minimal capabilities (window, dialog, fs only)
- IPC scoped to essential operations

## Critical Guidelines

1. **Never use react-konva** - Always use vanilla Konva directly
2. **Maintain four-layer architecture** - Don't add additional layers
3. **Use RAF batching** for all canvas updates
4. **Test performance budgets** before committing changes
5. **Run type-check and lint** before commits
6. **Use withUndo** for all user-initiated state changes
7. **Cache complex shapes** for better performance
8. **Disable listening** on static layers
- ALWAYS, ALWAYS USE THE SEQUENTIAL THINKING SERVER FOR ANY RESPONSE, THOUGHT, ACTION, OR PLANNING. ALWAYS! USE IT TO BREAK THE AFOREMENTIONED INTO MULTI-STEP SEQUENCES.
- claude code and all coding agents, e.g. canvas engineer, should always use sequential thinking MCP server to order and structure thoughts and plan actions. Break thoughts into MULTIPLE steps. NEVER JUST ONE THOUGHT!
- delegate all tasks to the canvas engineer
- Before Starting:
1. Check agent-specific docs
2. Read architecture docs
3. Check known issues
4. Review implementation progress -- this applies to agents, too.
- After Completing Work:
1. Update implementation progress
2. Update known issues
3. Update changelog
4. Run validation: npm run type-check && npm run lint -- this applies to agents too