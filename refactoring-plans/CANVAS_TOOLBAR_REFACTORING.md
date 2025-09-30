# Canvas Toolbar Refactoring Plan

**File**: `src/app/components/CanvasToolbar.tsx`  
**Current Size**: 696 lines  
**Target Size**: ~200 lines  
**Reduction**: 71%  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 days

---

## 📊 Current Structure Analysis

```
Lines 1-50:    Imports and setup
Lines 51-200:  Toolbar configuration - 149 lines
Lines 201-400: Toolbar state hooks - 199 lines
Lines 401-550: Color management - 149 lines
Lines 551-696: Toolbar components - 145 lines
```

---

## 🎯 Refactoring Strategy

1. **toolbarConfig.ts** (`components/toolbar/toolbarConfig.ts`) - ~160 lines
2. **useToolbarState.ts** (`components/toolbar/hooks/useToolbarState.ts`) - ~220 lines
3. **useColorManagement.ts** (`components/toolbar/hooks/useColorManagement.ts`) - ~160 lines
4. **Toolbar components** (`components/toolbar/`) - ~160 lines
5. **CanvasToolbar** (refactored) - ~200 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "toolbar-1-extract-config",
      "description": "Extract toolbar configuration to toolbarConfig.ts",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "line_range": "51-200"}],
      "code_changes": [
        {"operation": "create", "file": "src/app/components/toolbar/toolbarConfig.ts", "content": "Extract config:\n- TOOL_DEFINITIONS\n- TOOLBAR_GROUPS\n- SHORTCUT_KEYS\n- TOOL_ICONS"}
      ],
      "validation_steps": ["npm run type-check", "Verify toolbar displays"],
      "success_criteria": "Config extracted, toolbar renders identically",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/components/CanvasToolbar.tsx && rm src/app/components/toolbar/toolbarConfig.ts"
    },
    {
      "task_id": "toolbar-2-extract-state-hook",
      "description": "Extract toolbar state to useToolbarState hook",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "line_range": "201-400"}],
      "code_changes": [
        {"operation": "create", "file": "src/app/components/toolbar/hooks/useToolbarState.ts", "content": "Extract state hook:\n- currentTool state\n- handleToolChange()\n- handleShortcut()\n- isToolActive()\n- Return: { currentTool, setTool, isActive }"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- useToolbarState.test.ts", "Verify tool switching"],
      "success_criteria": "Tool switching works, shortcuts work",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/components/CanvasToolbar.tsx && rm src/app/components/toolbar/hooks/useToolbarState.ts"
    },
    {
      "task_id": "toolbar-3-extract-color-hook",
      "description": "Extract color management to useColorManagement hook",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "line_range": "401-550"}],
      "code_changes": [
        {"operation": "create", "file": "src/app/components/toolbar/hooks/useColorManagement.ts", "content": "Extract color hook:\n- currentColor state\n- recentColors state\n- handleColorChange()\n- addToRecent()\n- Return: { currentColor, setColor, recentColors }"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- useColorManagement.test.ts", "Verify color picker"],
      "success_criteria": "Color picker works, recent colors tracked",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/components/CanvasToolbar.tsx && rm src/app/components/toolbar/hooks/useColorManagement.ts"
    },
    {
      "task_id": "toolbar-4-extract-components",
      "description": "Extract toolbar sub-components",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "line_range": "551-696"}],
      "code_changes": [
        {"operation": "create", "file": "src/app/components/toolbar/ToolButton.tsx", "content": "Extract ToolButton component"},
        {"operation": "create", "file": "src/app/components/toolbar/ColorPicker.tsx", "content": "Extract ColorPicker component"},
        {"operation": "create", "file": "src/app/components/toolbar/ToolbarGroup.tsx", "content": "Extract ToolbarGroup component"}
      ],
      "validation_steps": ["npm run type-check", "Verify components render"],
      "success_criteria": "All toolbar elements render correctly",
      "dependencies": [],
      "rollback_procedure": "git checkout src/app/components/CanvasToolbar.tsx && rm src/app/components/toolbar/ToolButton.tsx && rm src/app/components/toolbar/ColorPicker.tsx && rm src/app/components/toolbar/ToolbarGroup.tsx"
    },
    {
      "task_id": "toolbar-5-refactor-component",
      "description": "Refactor CanvasToolbar to compose hooks and components",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "line_range": "1-696"}],
      "code_changes": [
        {"operation": "replace", "find_pattern": "All implementation", "replace_with": "Compose:\n- Import toolbarConfig\n- const { currentTool, setTool } = useToolbarState()\n- const { currentColor, setColor } = useColorManagement()\n- Render: <ToolbarGroup><ToolButton /></ToolbarGroup>"}
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Toolbar works identically, all features preserved",
      "dependencies": ["toolbar-1-extract-config", "toolbar-2-extract-state-hook", "toolbar-3-extract-color-hook", "toolbar-4-extract-components"],
      "rollback_procedure": "git checkout src/app/components/"
    },
    {
      "task_id": "toolbar-6-add-tests",
      "description": "Create test suites",
      "target_files": [
        {"path": "src/app/components/toolbar/hooks/__tests__/useToolbarState.test.ts", "status": "create"},
        {"path": "src/app/components/toolbar/hooks/__tests__/useColorManagement.test.ts", "status": "create"},
        {"path": "src/app/components/toolbar/__tests__/ToolButton.test.tsx", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/app/components/toolbar/hooks/__tests__/useToolbarState.test.ts", "content": "Test state hook"},
        {"operation": "create", "file": "src/app/components/toolbar/hooks/__tests__/useColorManagement.test.ts", "content": "Test color hook"},
        {"operation": "create", "file": "src/app/components/toolbar/__tests__/ToolButton.test.tsx", "content": "Test components"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["toolbar-2-extract-state-hook", "toolbar-3-extract-color-hook", "toolbar-4-extract-components"],
      "rollback_procedure": "rm src/app/components/toolbar/__tests__/*.test.ts && rm src/app/components/toolbar/hooks/__tests__/*.test.ts"
    },
    {
      "task_id": "toolbar-7-validation",
      "description": "Validate toolbar functionality",
      "target_files": [{"path": "src/app/components/CanvasToolbar.tsx", "validation": "functional"}],
      "code_changes": [
        {"operation": "validate", "checklist": ["All tools selectable", "Shortcuts work", "Color picker functional", "Recent colors tracked"]}
      ],
      "validation_steps": ["Manual testing", "Keyboard shortcuts", "Color selection"],
      "success_criteria": "All toolbar features work correctly",
      "dependencies": ["toolbar-5-refactor-component"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["toolbar-1-extract-config", "toolbar-2-extract-state-hook", "toolbar-3-extract-color-hook", "toolbar-4-extract-components", "toolbar-5-refactor-component", "toolbar-6-add-tests", "toolbar-7-validation"],
  "critical_warnings": ["⚠️ Keyboard shortcuts must work correctly", "⚠️ Tool switching must be instant", "⚠️ Color picker must preserve recent colors"]
}
```

---

## 🎯 Success Metrics

**Before**: 696 lines, monolithic component  
**After**: ~200 line component + 5 modules (~700 total)  
**Impact**: 71% component reduction, better reusability

---
