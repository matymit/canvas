# Contributing to Canvas

Welcome to Canvas development! This guide will help you understand our development practices, code standards, and contribution workflow.

## Code Standards and Conventions

### TypeScript Guidelines

#### Strict Type Safety
- **Always use explicit types** for function parameters and return values
- **No `any` types** - use proper typing or `unknown` with type guards
- **Prefer interfaces over types** for object definitions
- **Use strict null checks** - handle undefined/null cases explicitly

```typescript
// ✅ Good: Explicit types
interface CreateElementParams {
  type: ElementType;
  position: Point;
  dimensions: Size;
}

function createElement(params: CreateElementParams): CanvasElement {
  return {
    id: generateId(),
    type: params.type,
    x: params.position.x,
    y: params.position.y,
    width: params.dimensions.width,
    height: params.dimensions.height,
    created: Date.now(),
    modified: Date.now(),
  };
}

// ❌ Bad: Any types and implicit returns
function createElement(params: any) {
  // Missing return type, any parameters
}
```

#### Naming Conventions
- **PascalCase** for components, classes, interfaces, types
- **camelCase** for variables, functions, methods
- **UPPER_SNAKE_CASE** for constants
- **kebab-case** for file names

```typescript
// ✅ Good naming
interface CanvasElement { }
class DrawingTool { }
const MAX_CANVAS_SIZE = 10000;
const activeTool = 'pen';
function handlePointerDown() { }

// Files
canvas-layer-manager.ts
unified-canvas-store.ts
```

### Component Architecture

#### React Component Patterns
- **Functional components only** - no class components
- **Custom hooks** for reusable logic
- **Proper prop typing** with interfaces
- **Ref forwarding** when needed

```typescript
// ✅ Good component structure
interface ToolButtonProps {
  toolType: ToolType;
  isActive: boolean;
  onClick: (toolType: ToolType) => void;
  icon: ReactNode;
  shortcut?: string;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  toolType,
  isActive,
  onClick,
  icon,
  shortcut,
}) => {
  const handleClick = useCallback(() => {
    onClick(toolType);
  }, [onClick, toolType]);

  return (
    <button
      className={`tool-button ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      title={`${toolType}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
    </button>
  );
};
```

#### Canvas-Specific Patterns
- **Never use react-konva** - Direct Konva API only
- **Store-driven rendering** - UI components don't manipulate canvas directly
- **Event handler cleanup** - Always clean up in useEffect cleanup

```typescript
// ✅ Good: Direct Konva usage
const stage = new Konva.Stage({
  container: containerRef.current,
  width: window.innerWidth,
  height: window.innerHeight,
});

// ❌ Bad: Don't use react-konva
// import { Stage } from 'react-konva';
```

### Store Management

#### Zustand Store Patterns
- **Use withUndo** for all user-initiated changes
- **Batch operations** with beginBatch/endBatch
- **Selective subscriptions** with shallow equality
- **Immutable updates** through Immer

```typescript
// ✅ Good: Proper store usage
const handleAddElement = useCallback((element: CanvasElement) => {
  const store = useUnifiedCanvasStore.getState();

  store.history.withUndo('Add element', () => {
    store.element.upsert(element);
    store.selection.selectOne(element.id);
  });
}, []);

// ✅ Good: Selective subscription
const elements = useUnifiedCanvasStore(
  (state) => state.element.getAllElements(),
  shallow
);
```

### Tool Development

#### Tool Implementation Guidelines
- **Implement ToolEventHandler interface** properly
- **Preview on preview layer** during interaction
- **Commit to store** on completion
- **Cleanup resources** in cleanup method

```typescript
// ✅ Good tool structure
export class PenTool implements ToolEventHandler {
  toolType = 'pen' as const;
  priority = 1;

  private store = useUnifiedCanvasStore.getState();
  private currentStroke: Konva.Line | null = null;
  private isDrawing = false;

  onPointerDown(event: KonvaEventObject<PointerEvent>): boolean {
    this.isDrawing = true;
    this.startStroke(event);
    return true;
  }

  onPointerMove(event: KonvaEventObject<PointerEvent>): boolean {
    if (!this.isDrawing) return false;
    this.continueStroke(event);
    return true;
  }

  onPointerUp(event: KonvaEventObject<PointerEvent>): boolean {
    if (!this.isDrawing) return false;
    this.finishStroke();
    return true;
  }

  cleanup(): void {
    this.currentStroke?.destroy();
    this.currentStroke = null;
    this.isDrawing = false;
  }

  private startStroke(event: KonvaEventObject<PointerEvent>): void {
    // Create stroke on preview layer
  }

  private continueStroke(event: KonvaEventObject<PointerEvent>): void {
    // Update stroke with new points
  }

  private finishStroke(): void {
    // Commit to store and move to main layer
    this.store.history.withUndo('Draw stroke', () => {
      this.store.element.upsert(strokeElement);
    });
  }
}
```

### File Organization

#### Directory Structure
```
src/features/canvas/
├── components/          # React UI components
│   ├── tools/          # Tool implementations
│   ├── toolbar/        # Toolbar components
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── stores/             # Zustand store modules
│   └── modules/        # Store slice modules
├── renderer/           # Konva rendering modules
│   └── modules/        # Element-specific renderers
├── utils/              # Utility functions
│   ├── performance/    # Performance utilities
│   ├── geometry/       # Geometry calculations
│   └── drawing/        # Drawing utilities
├── types/              # TypeScript type definitions
│   └── elements/       # Element type definitions
└── constants/          # Application constants
```

#### Import Conventions
- **Absolute imports** from project root
- **Grouped imports** (external, internal, relative)
- **Type imports** separated from value imports

```typescript
// ✅ Good import structure
import React, { useCallback, useEffect } from 'react';
import Konva from 'konva';

import type { CanvasElement, ElementType } from '@/types';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';
import { ToolEventHandler } from '@features/canvas/types/tools';

import type { LocalComponentProps } from './types';
import { localUtility } from './utils';
```

## Development Workflow

### Setting Up for Development

#### 1. Fork and Clone
```bash
git clone <your-fork-url>
cd canvas
git remote add upstream <original-repo-url>
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### Making Changes

#### 1. Code Quality Checks
Run these before committing:
```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Tests
npm test
```

#### 2. Testing Your Changes
```bash
# Start development server
npm run dev

# Test specific functionality
npm test <specific-test-file>

# Performance testing
npm run test:performance-budgets
```

#### 3. Commit Guidelines
Use conventional commit format:
```bash
# Feature commits
git commit -m "feat: add connector tool with anchor snapping"

# Bug fixes
git commit -m "fix: resolve table cell editing coordinate issues"

# Documentation
git commit -m "docs: update API reference with new store methods"

# Refactoring
git commit -m "refactor: simplify tool event handling logic"

# Performance improvements
git commit -m "perf: optimize RAF batching for drawing tools"

# Tests
git commit -m "test: add unit tests for geometry utilities"
```

## Testing Requirements

### Unit Testing

#### Test Coverage Requirements
- **Minimum 70% coverage** for new code
- **80% coverage** for core store modules
- **Test all public APIs** and key functionality
- **Mock external dependencies** (Konva, browser APIs)

#### Testing Patterns
```typescript
// ✅ Good test structure
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUnifiedCanvasStore } from '../unifiedCanvasStore';

describe('UnifiedCanvasStore - Element Module', () => {
  let store: ReturnType<typeof createUnifiedCanvasStore>;

  beforeEach(() => {
    store = createUnifiedCanvasStore();
  });

  it('should add element to store', () => {
    const element: CanvasElement = {
      id: 'test-1',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      created: Date.now(),
      modified: Date.now(),
    };

    store.getState().element.upsert(element);

    expect(store.getState().element.getById('test-1')).toEqual(element);
  });

  it('should maintain element order after updates', () => {
    // Test implementation
  });
});
```

### Integration Testing

#### Canvas Operations Testing
- **Tool workflows** - complete user interactions
- **Store integrations** - multi-module operations
- **Rendering** - element creation and updates

```typescript
// ✅ Good integration test
describe('Drawing Tool Integration', () => {
  it('should complete pen drawing workflow', async () => {
    const { stage, layers } = setupTestCanvas();
    const store = createUnifiedCanvasStore();
    const penTool = new PenTool();

    // Simulate drawing
    const pointerDown = createPointerEvent('pointerdown', { x: 10, y: 10 });
    const pointerMove = createPointerEvent('pointermove', { x: 20, y: 20 });
    const pointerUp = createPointerEvent('pointerup', { x: 20, y: 20 });

    penTool.onPointerDown(pointerDown);
    penTool.onPointerMove(pointerMove);
    penTool.onPointerUp(pointerUp);

    // Verify element was created
    const elements = store.getState().element.getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('drawing');
  });
});
```

### Performance Testing

#### Performance Budget Validation
```bash
# Run performance budget tests
npm run test:performance-budgets

# Bundle size analysis
npm run test:bundle-size
```

#### Manual Performance Testing
- **Test with 1000+ elements** on canvas
- **Verify 60fps during rapid drawing**
- **Check memory usage** during extended sessions
- **Test on lower-end devices** if possible

## Pull Request Guidelines

### PR Preparation

#### Before Creating PR
1. **Rebase on latest main** branch
2. **Run all quality checks** and ensure they pass
3. **Test thoroughly** on development server
4. **Update documentation** if needed
5. **Add/update tests** for new functionality

```bash
# Prepare PR
git fetch upstream
git rebase upstream/main
npm run lint
npm run type-check
npm test
npm run build
```

#### PR Description Template
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Performance impact assessed

## Canvas-Specific Checklist
- [ ] No react-konva imports added
- [ ] Store operations use withUndo for user actions
- [ ] Tools properly clean up resources
- [ ] Layer count remains at 4
- [ ] RAF batching used for frequent updates
- [ ] Performance budgets maintained

## Screenshots/Videos
(If applicable, add screenshots or videos demonstrating the changes)

## Related Issues
Closes #123
```

### Code Review Process

#### Review Criteria
- **Code quality** - TypeScript standards, clean code
- **Architecture compliance** - follows Canvas patterns
- **Performance** - no regressions, maintains budgets
- **Testing** - adequate coverage and quality
- **Documentation** - updated where necessary

#### Addressing Review Feedback
1. **Make requested changes** in new commits
2. **Respond to comments** with explanations when needed
3. **Re-request review** after addressing feedback
4. **Squash commits** before final merge (if requested)

## Architecture Guidelines

### Canvas-Specific Rules

#### Layer Management
- **Maintain exactly 4 layers** - never add more
- **Use correct layer for content**:
  - Background: Static grid, backgrounds
  - Main: Committed elements
  - Preview: Tool previews, temporary content
  - Overlay: Selection handles, UI elements

#### Performance Requirements
- **60fps target** - use RAF batching for updates
- **Memory bounds** - clean up resources properly
- **Node limits** - max 1000 nodes per layer
- **Bundle size** - keep under 4MB total

#### Store Integration
- **ID-based references** - never store Konva nodes in state
- **Immutable updates** - use Immer for all mutations
- **History support** - use withUndo for user actions
- **Serializable state** - all state must be JSON serializable

### Common Patterns

#### Event Handling
```typescript
// ✅ Good: Priority-based event handling
class CustomTool implements ToolEventHandler {
  priority = 1; // Higher priority = handles events first

  onPointerDown(event: KonvaEventObject<PointerEvent>): boolean {
    // Handle event
    return true; // Return true if event was handled
  }
}
```

#### State Updates
```typescript
// ✅ Good: Proper store usage with history
const handleUpdate = useCallback(() => {
  const store = useUnifiedCanvasStore.getState();

  store.history.withUndo('Update elements', () => {
    store.element.update(elementId, { x: newX, y: newY });
    store.selection.selectOne(elementId);
  });
}, [elementId, newX, newY]);
```

#### Component Cleanup
```typescript
// ✅ Good: Proper cleanup
useEffect(() => {
  const tool = new CustomTool();
  eventManager.registerTool(tool);

  return () => {
    tool.cleanup();
    eventManager.unregisterTool(tool.toolType);
  };
}, []);
```

## Documentation Standards

### Code Documentation

#### JSDoc Comments
```typescript
/**
 * Creates a new canvas element with the specified properties.
 *
 * @param type - The type of element to create
 * @param position - Initial position coordinates
 * @param dimensions - Width and height of the element
 * @returns The created canvas element with generated ID
 *
 * @example
 * ```typescript
 * const element = createElement('rectangle', { x: 10, y: 20 }, { width: 100, height: 50 });
 * ```
 */
function createElement(
  type: ElementType,
  position: Point,
  dimensions: Size
): CanvasElement;
```

#### README Updates
- **Update feature lists** when adding new functionality
- **Document breaking changes** in architecture
- **Add usage examples** for new APIs
- **Update installation/setup** if dependencies change

### Architectural Documentation

#### When to Update Architecture Docs
- **New tool implementations** - add to tool registry section
- **Store module changes** - update state model documentation
- **Performance optimizations** - update performance section
- **New component patterns** - add to best practices

## Release Process

### Versioning
- **Semantic versioning** (MAJOR.MINOR.PATCH)
- **Major**: Breaking changes to public APIs
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes, performance improvements

### Changelog Updates
- **Add entries** for all user-facing changes
- **Group by type**: Features, Bug Fixes, Performance, etc.
- **Include migration notes** for breaking changes

## Getting Help

### Internal Resources
- **CLAUDE.md** - AI assistant with architectural knowledge
- **Existing implementations** - study similar tools/components
- **Test files** - examples of proper testing patterns

### Code Review Support
- **Ask for specific feedback** on architectural decisions
- **Request performance review** for complex changes
- **Seek guidance** on testing approaches

### Community Guidelines
- **Be respectful** in all interactions
- **Provide context** when asking questions
- **Share knowledge** through documentation and examples
- **Help others** with code reviews and guidance

---

## Quick Reference

### Before Every Commit
```bash
npm run lint:fix
npm run format
npm run type-check
npm test
```

### Canvas Architecture Rules
1. **No react-konva** - Direct Konva only
2. **4 layers maximum** - Background, Main, Preview, Overlay
3. **Store-driven rendering** - No direct canvas manipulation from UI
4. **withUndo for user actions** - All user changes must be undoable
5. **RAF batch updates** - Performance-critical operations
6. **Clean up resources** - Event listeners, Konva nodes, timers

### Common Import Patterns
```typescript
// Store access
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

// Types
import type { CanvasElement, ElementType, ToolType } from '@/types';

// Tools
import type { ToolEventHandler } from '@features/canvas/types/tools';

// Performance
import { batchedRAF } from '@features/canvas/utils/performance/RafBatcher';
```

Thank you for contributing to Canvas! Your adherence to these guidelines helps maintain code quality and ensures the project remains maintainable and performant.