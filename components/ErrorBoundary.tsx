
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h1 className="text-xl font-black text-gray-800 mb-2">اوه! مشکلی پیش آمد</h1>
            <p className="text-gray-500 text-sm mb-4">
              نرم‌افزار با یک خطای غیرمنتظره مواجه شد.
            </p>
            
            <div className="bg-gray-100 p-3 rounded-lg text-left dir-ltr mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-600 font-mono break-all">
                {this.state.error?.toString()}
              </code>
            </div>

            <button 
              onClick={() => {
                  localStorage.removeItem('app_current_user'); // Optional: logout user to reset state
                  window.location.reload();
              }} 
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <RefreshCcw size={18} />
              بارگذاری مجدد برنامه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
