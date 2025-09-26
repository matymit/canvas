# Canvas - FigJam-Style Collaborative Canvas Application

A modern, high-performance canvas application built with React, TypeScript, Konva.js, and Tauri. Designed for collaborative drawing, diagramming, and visual thinking.

## 🎯 Project Overview

> **Architectural Compliance Note:** While this project is designed to follow the principles in the master blueprint (vanilla Konva, four-layer pipeline, store-driven rendering), the current implementation has significant architectural violations as documented in the `technical-audit-report.md`. These include direct canvas manipulation bypassing the state store and viewport race conditions. Active work is underway to refactor the code and bring it into full compliance.

Canvas provides a FigJam-inspired drawing experience with a focus on performance, modularity, and desktop-first design. Built on a strict four-layer rendering architecture, the application delivers smooth 60fps interactions while maintaining clean, maintainable code.

### ✨ Key Features

**🎨 Drawing & Creation Tools**
- Pen, marker, and highlighter drawing tools
- Shape creation (rectangles, circles, triangles)
- Text editing with content-hugging behavior
- Table creation with multi-line cell editing
- Sticky notes with color customization

**🔧 Core Functionality**
- Four-layer Konva.js rendering pipeline
- Zustand-based state management with undo/redo
- Direct canvas manipulation (no react-konva)
- Event-driven tool system with priority handling
- Modular renderer architecture

**🖥️ Desktop Integration**
- Tauri-based desktop application
- Native file system access
- Cross-platform support (Windows, macOS, Linux)
- Secure IPC with capability-based permissions

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** toolchain (for desktop builds)
- Modern web browser for development

### Installation & Development

```bash
# Clone the repository
git clone <repository-url>
cd canvas

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the application running.

### Desktop Development

```bash
# Start Tauri development mode
npm run tauri:dev

# Build desktop application
npm run tauri:build:production
```

## 📖 Documentation

### 🚀 Getting Started
- **[Getting Started Guide](./docs/getting-started.md)** - Complete setup and development guide
- **[Architecture Overview](./docs/architecture/README.md)** - System design and technical details

### 🔧 Development
- **[API Reference](./docs/development/api-reference.md)** - Comprehensive API documentation
- **[Contributing Guide](./docs/development/contributing.md)** - Code standards and workflow
- **[Troubleshooting](./docs/development/troubleshooting.md)** - Common issues and solutions

### 📋 Project Information
- **[Changelog](./docs/CHANGELOG.md)** - Version history and updates
- **[Documentation Hub](./docs/README.md)** - Complete documentation index

## 🏗️ Architecture Highlights

### Four-Layer Rendering Pipeline
```
┌─ Overlay Layer ─────┐  ← Selection handles, UI elements
├─ Preview Layer ─────┤  ← Tool previews, temporary content
├─ Main Layer ────────┤  ← Committed canvas elements
└─ Background Layer ──┘  ← Static grid, backgrounds
```

### Core Technologies
- **Frontend**: React 19 + TypeScript + Vite
- **Canvas**: Vanilla Konva.js (direct API usage)
- **State**: Zustand with Immer for immutability
- **Desktop**: Tauri 2.x with Rust backend
- **Performance**: RAF batching, spatial indexing, viewport culling

### Modular Design
- **Store Modules**: Element, History, Selection, Viewport, UI
- **Renderer Modules**: Element-specific rendering with subscriptions
- **Tool System**: Priority-based event handling with cleanup
- **Utility Modules**: Performance, geometry, drawing operations

## 🛠️ Development Commands

### Core Development
```bash
npm run dev                    # Start development server
npm run build                  # Build for production
npm run tauri:dev             # Desktop development mode
npm run tauri:build:production # Build desktop app
```

### Code Quality
```bash
npm run type-check            # TypeScript validation
npm run lint                  # ESLint checking
npm run lint:fix              # Auto-fix linting issues
npm run format                # Prettier formatting
npm test                      # Run test suite
```

### Performance & Analysis
```bash
npm run build:analyze         # Bundle size analysis
npm run test:performance-budgets # Performance validation
npm run audit:security        # Security audit
```

## 🎯 Current Status

### ✅ Implemented
- **Core Architecture**: Four-layer pipeline, store modules
- **Basic Tools**: Drawing (pen, marker, highlighter), shapes, text
- **Table System**: Grid creation with cell editing
- **State Management**: Undo/redo, selection, viewport controls
- **Desktop Framework**: Tauri integration and build system

### 🚧 In Development
- **Advanced Tools**: Connector tools with live routing (stabilized selection: endpoint-only; consistent rect policy; hover-port suppression)
- **Mindmap System**: Node creation and hierarchical branching
- **Image Handling**: Upload and manipulation features
- **Performance**: Optimization and monitoring systems

### ⏳ Planned
- **Accessibility**: WCAG 2.1 AA compliance
- **Collaboration**: Real-time multi-user editing
- **Advanced UI**: Contextual toolbars and panels
- **Production**: Security hardening and deployment optimization

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/development/contributing.md) for:

- **Code Standards**: TypeScript patterns, component architecture
- **Development Workflow**: Branch management, testing requirements
- **Canvas-Specific Guidelines**: Tool creation, store integration
- **Performance Requirements**: 60fps targets, memory management

### Quick Contribution Steps
1. Fork the repository
2. Create a feature branch
3. Make your changes following our code standards
4. Run quality checks: `npm run lint && npm run type-check && npm test`
5. Submit a pull request with clear description

## 📊 Performance & Quality

### Performance Targets
- **Frame Rate**: 60 FPS sustained during interactions
- **Memory Usage**: < 500MB peak for typical usage
- **Bundle Size**: < 4MB total compressed
- **Load Time**: < 3s time to interactive

### Quality Assurance
- **TypeScript**: Strict type checking, no `any` types
- **Testing**: Unit and integration tests with >70% coverage
- **Linting**: ESLint + Prettier for consistent code style
- **Architecture**: Four-layer compliance, no react-konva usage

## 🔒 Security & Privacy

- **Local-First**: Data stored locally by default
- **Capability-Based**: Minimal Tauri permissions
- **Content Security Policy**: Strict CSP without unsafe-inline
- **No Telemetry**: Privacy-focused with optional analytics

## 📄 License

[Add appropriate license information]

## 🆘 Support & Community

### Getting Help
- **Documentation**: Start with [Getting Started Guide](./docs/getting-started.md)
- **Issues**: Check existing issues before creating new ones
- **Development**: See [Troubleshooting Guide](./docs/development/troubleshooting.md)

### Project Maintenance
This project is actively maintained with regular updates focusing on:
- Core feature completion
- Performance optimization
- Developer experience improvements
- Documentation quality (see [Known Issues](./docs/known-issues.md) and [Changelog](./docs/CHANGELOG.md))

---

## 🎬 Development Philosophy

Canvas is built with these core principles:

**🎯 Performance First**
- 60fps interactions at scale
- Memory-efficient operations
- Optimized rendering pipeline

**🔧 Developer Experience**
- Clear architectural patterns
- Comprehensive documentation
- Modular, testable design

**🎨 User-Centric Design**
- Intuitive tool interactions
- Responsive, fluid experience
- Accessibility considerations

**🔒 Quality & Security**
- Type-safe implementation
- Secure desktop integration
- Robust error handling

---

**Ready to contribute?** Start with our [Getting Started Guide](./docs/getting-started.md) and explore the [Architecture Overview](./docs/architecture/README.md) to understand the system design.

**Questions?** Check the [Troubleshooting Guide](./docs/development/troubleshooting.md) or browse through our comprehensive [Documentation Hub](./docs/README.md).