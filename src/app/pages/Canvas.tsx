// src/app/pages/Canvas.tsx
// Simplified page component that only renders FigJamCanvas
// All canvas logic moved to FigJamCanvas.tsx to avoid conflicts
import React from "react";
import FigJamCanvas from "../../features/canvas/components/FigJamCanvas";

export default function Canvas(): JSX.Element {
  console.log("[Canvas] Page component initialized - delegating to FigJamCanvas");
  return <FigJamCanvas />;
}