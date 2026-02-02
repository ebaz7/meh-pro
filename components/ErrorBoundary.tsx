import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center" dir="rtl">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-red-100 max-w-md w-full">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600" size={40} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">خطای سیستمی</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              برنامه با مشکل مواجه شد. لطفاً صفحه را مجدداً بارگذاری کنید.
            </p>
            
            <div className="bg-gray-100 p-4 rounded-xl text-left dir-ltr mb-6 overflow-auto max-h-40 border border-gray-200">
              <code className="text-xs text-red-600 font-mono break-all font-bold">
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>

            <button 
                onClick={() => {
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                }} 
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
                <RefreshCcw size={18} />
                <span>تلاش مجدد</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;