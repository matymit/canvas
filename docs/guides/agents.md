# Agent Guidelines

## Commands

- **Single test**: `npm test <file-path>` (e.g., `npm test src/features/canvas/__tests__/unit/accessibility.test.ts`)
- **All tests**: `npm test`
- **Type check**: `npm run type-check`
- **Lint**: `npm run lint` and `npm run lint:fix`
- **Format**: `npm run format` and `npm run format:check`

## Code Style

- **Imports**: Use path aliases (`@/*`, `@features/*`, `@types`)
- **Types**: Strict TypeScript enabled, explicit types for complex objects
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error handling**: Use try/catch with proper typing, avoid `any`
- **Canvas**: Always use vanilla Konva directly (never react-konva)
- **State**: Use Zustand with Immer, wrap user actions in `withUndo()`
- **Performance**: Batch canvas updates with RAF, cache complex shapes
