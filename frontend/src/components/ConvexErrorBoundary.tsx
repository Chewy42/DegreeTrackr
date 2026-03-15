import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

class ConvexErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('ConvexErrorBoundary caught:', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen flex items-center justify-center bg-surface-muted text-text-primary px-4"
        >
          <div className="text-center max-w-md space-y-4">
            <p className="text-base font-medium">
              Could not connect to the server. Please check your internet connection and reload the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-contrast text-sm font-semibold py-3 px-6 shadow-md transition-all duration-200 hover:bg-primary-emphasis"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ConvexErrorBoundary;
