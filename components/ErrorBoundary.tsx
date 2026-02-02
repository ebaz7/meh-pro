import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component to catch runtime errors in the component tree.
 */
// Fix: Inherit from React.Component with explicit generic types for props and state to ensure proper member recognition.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Initializing state as a class property (replaces line 19 constructor initialization) ensures 'state' is recognized as a member of ErrorBoundary.
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  // Fix: Provide correct return type for static state derivation.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  // Fix: Lifecycle method to catch and log component errors.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console
    console.error("Uncaught error:", error, errorInfo);
    // Fix: Using the inherited setState method from the React.Component base class (Resolves error on line 35).
    this.setState({ errorInfo });
  }

  render() {
    // Fix: Accessing state through 'this.state' which is now correctly typed and recognized (Resolves error on line 40).
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h1 className="text-xl font-black text-gray-800 mb-2">اوه! مشکلی پیش آمد</h1>
            <p className="text-gray-500 text-sm mb-4">نرم‌افزار با یک خطای غیرمنتظره مواجه شد.</p>
            
            <div className="bg-gray-100 p-3 rounded-lg text-left dir-ltr mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-600 font-mono break-all">
                {/* Fix: Accessing error property from the inherited state object (Resolves error on line 53). */}
                {this.state.error?.toString()}
              </code>
            </div>

            <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
            >
                <RefreshCcw size={18} />
                <span>تلاش مجدد (رفرش)</span>
            </button>
          </div>
        </div>
      );
    }

    // Fix: Accessing the children from inherited props property (Resolves error on line 70).
    return this.props.children;
  }
}

export default ErrorBoundary;