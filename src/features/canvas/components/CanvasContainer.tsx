// features/canvas/components/CanvasContainer.tsx
import React, { PropsWithChildren, ReactElement, cloneElement } from 'react';
import type Konva from 'konva';

export interface CanvasContainerProps {
  className?: string;
  // Will be forwarded to the single child (NonReactCanvasStage)
  onStageReady?: (stage: Konva.Stage) => void;
  // Optional test-id or DOM id
  id?: string;
  'data-testid'?: string;
}

/**
 * CanvasContainer
 * - Simple layout shell for the canvas area.
 * - Forwards onStageReady to its single ReactElement child to avoid prop drilling in the page component.
 */
export function CanvasContainer({
  className,
  id,
  onStageReady,
  children,
  ...rest
}: PropsWithChildren<CanvasContainerProps>): JSX.Element {
  // Enforce a single child and forward onStageReady if present
  const child = React.Children.only(children) as ReactElement<any>;
  const forwarded = cloneElement(child, { onStageReady, ...child.props });

  return (
    <div
      id={id}
      className={className ?? 'relative h-full w-full'}
      data-testid={rest['data-testid'] ?? 'canvas-container'}
      role="main"
      aria-label="Canvas Work Area"
    >
      {forwarded}
    </div>
  );
}

export default CanvasContainer;