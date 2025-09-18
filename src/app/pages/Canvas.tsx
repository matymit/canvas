// src/app/pages/Canvas.tsx
// Simplified page component that only renders FigJamCanvas
// All canvas logic moved to FigJamCanvas.tsx to avoid conflicts
// No React import needed since we only use JSX.Element type
import FigJamCanvas from "../../features/canvas/components/FigJamCanvas";

export default function Canvas(): JSX.Element {
  return <FigJamCanvas />;
}