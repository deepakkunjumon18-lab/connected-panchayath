import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from '../ui/Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-8 bg-white rounded-3xl shadow-soft border border-slate-200 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                An unexpected UI error occurred while rendering this view. Your session and records are safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-left font-mono text-[11px] text-slate-700 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                icon={RefreshCw}
                onClick={this.handleReset}
                className="w-full sm:w-auto justify-center"
              >
                Reload Page
              </Button>
              <a href="/" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  icon={Home}
                  className="w-full justify-center"
                >
                  Return Home
                </Button>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
