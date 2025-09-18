# Getting Started with Canvas Development

Welcome to the Canvas application development! This guide will help you set up your development environment and understand the project structure.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Git** for version control
- **VS Code** (recommended) or your preferred code editor

### System Requirements
- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Memory**: At least 8GB RAM (16GB recommended for development)
- **Storage**: 2GB free space for dependencies and build artifacts

### For Tauri Desktop Development (Optional)
- **Rust** toolchain - [Install via rustup](https://rustup.rs/)
- **System dependencies** for your platform:
  - **Windows**: Microsoft C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: build-essential, libwebkit2gtk-4.0-dev, libgtk-3-dev

## Quick Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd canvas
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

This starts the web development server at `http://localhost:5173` (or similar port).

### 4. Verify Setup
- Open your browser to the development URL
- You should see the Canvas application interface
- Try creating a simple shape to verify the canvas is working

## Development Commands

### Core Development
```bash
# Start web development server
npm run dev

# Start Tauri desktop development (requires Rust)
npm run tauri:dev

# Build for production
npm run build

# Build Tauri desktop app
npm run tauri:build:production
```

### Quality Assurance
```bash
# Run type checking
npm run type-check

# Run linting
npm run lint
npm run lint:fix

# Run tests
npm test

# Run specific test file
npm test <file-path>

# Format code
npm run format
npm run format:check
```

### Performance & Analysis
```bash
# Analyze bundle size
npm run build:analyze
npm run test:bundle-size

# Run performance tests
npm run test:performance-budgets

# Security audit
npm run audit:security
```

## Project Structure Overview

```
canvas/
├── src/
│   ├── app/                    # Application routing and pages
│   ├── features/canvas/        # Main canvas feature module
│   │   ├── components/         # React components (toolbar, tools)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── stores/             # Zustand store modules
│   │   ├── renderer/           # Konva rendering modules
│   │   ├── utils/              # Utility functions
│   │   └── types/              # TypeScript type definitions
│   └── shared/                 # Shared utilities and components
├── docs/                       # Documentation
├── src-tauri/                  # Tauri desktop app configuration
├── tests/                      # Test files
└── scripts/                    # Build and development scripts
```

### Key Directories Explained

#### `src/features/canvas/`
The heart of the application containing all canvas-related functionality:

- **`stores/`** - Zustand state management with modular slices
- **`renderer/`** - Konva.js rendering modules for different element types
- **`components/`** - React UI components including tools and toolbar
- **`hooks/`** - Custom hooks for canvas operations and event handling
- **`utils/`** - Helper functions for drawing, performance, spatial operations

#### `src/app/`
Application-level routing, pages, and layout components.

#### `docs/`
Comprehensive documentation including architecture specs and guides.

## Understanding the Canvas Architecture

### Core Concepts

#### 1. Four-Layer Rendering Pipeline
The canvas uses exactly four Konva layers (never more):
1. **Background** - Static grid and background elements
2. **Main** - All committed canvas elements (shapes, text, drawings)
3. **Preview** - Temporary drawing operations and tool previews
4. **Overlay** - Selection handles, guides, UI overlays

#### 2. Store-Driven Architecture
- **Zustand store** manages all application state
- **Element store** handles canvas elements with unique IDs
- **History store** provides undo/redo functionality
- **Interaction store** manages selection, viewport, tools

#### 3. Tool System
- Each tool implements a standard interface
- Tools preview on the preview layer
- Elements are committed to the main layer via the store
- Event management routes interactions to active tools

### State Management Pattern
```typescript
// Access the unified store
const store = useUnifiedCanvasStore();

// Add element with undo support
store.history.withUndo('Add shape', () => {
  store.element.upsert(newElement);
});

// Update element
store.element.update(elementId, { x: 100, y: 200 });

// Get element by ID
const element = store.element.getById(elementId);
```

## Development Workflow

### 1. Starting Development
1. Run `npm run dev` to start the development server
2. Open browser to view the application
3. Make changes to source files
4. Hot reload will update the browser automatically

### 2. Making Changes
1. **UI Changes**: Edit components in `src/features/canvas/components/`
2. **Tool Logic**: Modify or create tools in `src/features/canvas/components/tools/`
3. **Rendering**: Update renderer modules in `src/features/canvas/renderer/`
4. **State**: Modify store modules in `src/features/canvas/stores/modules/`

### 3. Testing Changes
1. **Manual Testing**: Use the dev server to test functionality
2. **Unit Tests**: Run `npm test` for automated tests
3. **Type Checking**: Run `npm run type-check` for TypeScript validation
4. **Linting**: Run `npm run lint` for code quality checks

### 4. Code Quality
1. **Format Code**: Run `npm run format` before committing
2. **Fix Linting**: Run `npm run lint:fix` to auto-fix issues
3. **Check Types**: Ensure `npm run type-check` passes
4. **Test Coverage**: Maintain good test coverage for new features

## First Steps for New Developers

### 1. Explore the Codebase
- Read through `docs/architecture/README.md` for system overview
- Browse `src/features/canvas/` to understand the structure
- Look at existing tools in `src/features/canvas/components/tools/`

### 2. Run the Application
- Start the dev server and interact with the canvas
- Try different tools: drawing, shapes, text, tables
- Open browser DevTools to see console logs and performance

### 3. Make Your First Change
- Try modifying a tool's behavior (e.g., change default stroke color)
- Add a console.log to see how events flow through the system
- Create a simple new shape tool following existing patterns

### 4. Learn the Patterns
- Study how tools preview on the preview layer
- Understand how elements are committed to the store
- Learn the event flow from user interaction to canvas rendering

## Common Development Tasks

### Adding a New Tool
1. Create tool implementation in `src/features/canvas/components/tools/`
2. Add TypeScript types if needed
3. Register tool in `ToolManager`
4. Add toolbar button in appropriate component
5. Test the complete flow: select → preview → commit → select

### Adding a New Element Type
1. Define TypeScript types in `src/features/canvas/types/`
2. Create renderer module in `src/features/canvas/renderer/modules/`
3. Register renderer in the registry
4. Update store types to include new element
5. Create creation tool following tool patterns

### Debugging Issues
1. **Check browser console** for errors and warnings
2. **Use React DevTools** to inspect component state
3. **Check Zustand DevTools** for store state changes
4. **Monitor performance** with browser Performance tab
5. **Test in different browsers** for compatibility

## Getting Help

### Documentation Resources
- [Architecture Overview](./architecture/README.md) - System design and technical details
- [Development Guides](./development/) - In-depth development documentation
- [Troubleshooting Guide](./development/troubleshooting.md) - Common issues and solutions

### Code Exploration
- **CLAUDE.md** - AI assistant instructions with architectural patterns
- **Component examples** - Study existing tool implementations
- **Type definitions** - Comprehensive TypeScript types for guidance

### Community & Support
- Check existing issues in the repository
- Look at recent commits and pull requests for context
- Follow established code patterns and conventions

---

## Next Steps

Once you have the development environment running:

1. 📖 **Read the [Architecture Overview](./architecture/README.md)** to understand the system design
2. 🔧 **Explore [Development Guides](./development/)** for detailed development patterns
3. 🚀 **Try creating a simple tool** following existing patterns
4. 🐛 **Check [Troubleshooting Guide](./development/troubleshooting.md)** if you encounter issues

Welcome to Canvas development! The modular architecture and comprehensive documentation will help you become productive quickly.