import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      copied: false 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Presenter Uncaught Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleResume = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const errorText = `Presenter Error Log:
Message: ${this.state.error?.message || 'Unknown error'}
Stack: ${this.state.error?.stack || 'N/A'}
Component Stack: ${this.state.errorInfo?.componentStack || 'N/A'}`;
    navigator.clipboard.writeText(errorText);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#FAF6F0] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#E4E1DA] shadow-sm p-8 flex flex-col items-center gap-6 animate-in fade-in duration-300">
            {/* Friendly Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#FFF4E5] border border-[#7A502A]/25 text-[#7A502A] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            {/* Reassuring Volunteer-Friendly Message */}
            <div>
              <h2 className="text-lg font-black text-[#1C355E] uppercase tracking-wider">
                Temporary Hiccup
              </h2>
              <p className="text-xs text-[#526075] mt-2 leading-relaxed">
                Presenter caught an unexpected issue. Don&apos;t worry—your service order, library songs, and background settings are safely preserved in storage.
              </p>
            </div>

            {/* Clear Primary Actions */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={this.handleResume}
                className="w-full py-3 px-4 bg-[#7A502A] hover:bg-[#654121] active:scale-[0.98] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm"
              >
                Resume Presentation
              </button>
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] text-xs font-bold rounded-xl transition border border-[#E4E1DA]"
              >
                Reload Window
              </button>
            </div>

            {/* Expandable Technical Details */}
            <div className="w-full pt-4 border-t border-[#E4E1DA] flex flex-col items-center">
              <button
                onClick={this.handleCopyError}
                className="text-[11px] font-bold text-[#526075] hover:text-[#1C355E] transition"
              >
                {this.state.copied ? "✓ Copied Error Details" : "Copy Error Details for Support"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
