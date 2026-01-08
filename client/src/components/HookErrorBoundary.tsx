import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

const MAX_RETRIES = 2;
const RETRY_KEY = 'hook_error_retry_count';
const RETRY_TIMESTAMP_KEY = 'hook_error_retry_timestamp';

export class HookErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    const storedRetryCount = sessionStorage.getItem(RETRY_KEY);
    const storedTimestamp = sessionStorage.getItem(RETRY_TIMESTAMP_KEY);
    const now = Date.now();
    
    let retryCount = 0;
    if (storedRetryCount && storedTimestamp) {
      const timestamp = parseInt(storedTimestamp, 10);
      if (now - timestamp < 30000) {
        retryCount = parseInt(storedRetryCount, 10);
      } else {
        sessionStorage.removeItem(RETRY_KEY);
        sessionStorage.removeItem(RETRY_TIMESTAMP_KEY);
      }
    }
    
    this.state = { hasError: false, retryCount };
  }

  static getDerivedStateFromError(_: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isHookError = 
      error.message?.includes('Invalid hook call') ||
      error.message?.includes('Cannot read properties of null') ||
      error.message?.includes('useState') ||
      error.message?.includes('useEffect');
    
    if (isHookError && this.state.retryCount < MAX_RETRIES) {
      console.log(`[HookErrorBoundary] Hook error detected, refreshing page (attempt ${this.state.retryCount + 1}/${MAX_RETRIES})...`);
      
      sessionStorage.setItem(RETRY_KEY, String(this.state.retryCount + 1));
      sessionStorage.setItem(RETRY_TIMESTAMP_KEY, String(Date.now()));
      
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } else if (isHookError) {
      console.error('[HookErrorBoundary] Max retries reached, showing error UI');
      sessionStorage.removeItem(RETRY_KEY);
      sessionStorage.removeItem(RETRY_TIMESTAMP_KEY);
    }
  }

  handleManualRefresh = () => {
    sessionStorage.removeItem(RETRY_KEY);
    sessionStorage.removeItem(RETRY_TIMESTAMP_KEY);
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.retryCount >= MAX_RETRIES) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-4">Si è verificato un errore</h2>
            <p className="text-muted-foreground mb-6">
              La pagina ha riscontrato un problema. Prova a ricaricare.
            </p>
            <button
              onClick={this.handleManualRefresh}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
