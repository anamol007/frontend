import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, err: error };
  }
  componentDidCatch(error, info) {
    // Optional: log to your monitoring here
    // console.error('ErrorBoundary caught', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
          <div className="max-w-md rounded-2xl border p-6 bg-white shadow">
            <h1 className="text-lg font-semibold text-rose-600">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">{String(this.state.err || '')}</p>
            <button
              onClick={() => this.setState({ hasError: false, err: null })}
              className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-white"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}