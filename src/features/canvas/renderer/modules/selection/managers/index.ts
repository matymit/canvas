// managers/index.ts
// Export all selection managers

export type { 
  TransformStateManager, 
  TransformSnapshot 
} from './TransformStateManager';

export { 
  TransformStateManagerImpl, 
  transformStateManager
} from './TransformStateManager';

export type { 
  ElementSynchronizer, 
  ElementSynchronizationOptions 
} from './ElementSynchronizer';

export { 
  ElementSynchronizerImpl, 
  elementSynchronizer
} from './ElementSynchronizer';

export type { 
  ConnectorSelectionManager
} from './ConnectorSelectionManager';

export { 
  ConnectorSelectionManagerImpl, 
  connectorSelectionManager 
} from './ConnectorSelectionManager';

export type { 
  MindmapSelectionManager,
  MindmapRendererLike
} from './MindmapSelectionManager';

export { 
  MindmapSelectionManagerImpl, 
  mindmapSelectionManager,
  isMindmapRenderer 
} from './MindmapSelectionManager';

export type { 
  ShapeTextSynchronizer
} from './ShapeTextSynchronizer';

export { 
  ShapeTextSynchronizerImpl, 
  shapeTextSynchronizer 
} from './ShapeTextSynchronizer';

// Re-export singleton instances for easy access
import { transformStateManager } from './TransformStateManager';
import { elementSynchronizer } from './ElementSynchronizer';
import { connectorSelectionManager } from './ConnectorSelectionManager';
import { mindmapSelectionManager } from './MindmapSelectionManager';
import { shapeTextSynchronizer } from './ShapeTextSynchronizer';

export const selectionManagers = {
  transform: transformStateManager,
  elementSync: elementSynchronizer,
  connector: connectorSelectionManager,
  mindmap: mindmapSelectionManager,
  shapeText: shapeTextSynchronizer
} as const;