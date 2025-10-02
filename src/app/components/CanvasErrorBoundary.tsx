import React from "react";
import { error } from "../../utils/debug";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(caughtError: unknown): State {
    return { hasError: true, message: (caughtError as Error)?.message };
  }

  componentDidCatch(caughtError: unknown, errorInfo: unknown) {
    error("CanvasErrorBoundary: crash captured", {
      category: "app/error-boundary",
      data: {
        error: caughtError,
        errorInfo,
      },
      force: true,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, color: "#f87171", background: "#111827", border: "1px solid #4b5563", borderRadius: 8 }}>
          <strong>Canvas crashed</strong>
          <div style={{ marginTop: 8, color: "#e5e7eb" }}>
            {this.state.message || "A rendering error occurred. Check console for details."}
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}


