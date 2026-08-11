import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/utils/logger';
import { getLatestDiagnosticContext } from '@/utils/diagnostics';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const diagnostics = getLatestDiagnosticContext();
    logger.error({
      event: 'exit',
      module: 'ErrorBoundary',
      function: 'componentDidCatch',
      status: 'failed',
      error: error.message,
      input: info.componentStack?.slice(0, 200),
      ...diagnostics,
      operation: 'react_render',
      outcome: 'failed',
      source: 'react',
      reasonCode: 'render',
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 300,
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-secondary)',
            gap: 16,
          }}
          role="alert"
          aria-label="页面加载出错"
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--f1-red-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>
            页面加载出错
          </h3>
          <p style={{ margin: 0, maxWidth: 400 }}>
            请刷新页面重试。如果问题持续，请联系我们。
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-control, 8px)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
