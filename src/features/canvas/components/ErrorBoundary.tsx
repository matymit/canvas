// features/canvas/components/ErrorBoundary.tsx
import React from 'react';

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          className="m-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          <div className="font-semibold">Something went wrong rendering the canvas.</div>
          <div className="mt-1 opacity-80">
            {this.state.error?.message ?? 'Unknown error'}
          </div>
          <button
            type="button"
            className="mt-3 rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
            onClick={this.handleReset}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;