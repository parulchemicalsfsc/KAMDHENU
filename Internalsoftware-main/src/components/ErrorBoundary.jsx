import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    // Reset the error state to try rendering again
    this.setState({ hasError: false, error: null });
    // Reload the page to ensure clean state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f8f9fa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '500px'
          }}>
            <h1 style={{ color: '#dc3545', marginBottom: '16px' }}>Oops! Something went wrong.</h1>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={this.handleReset}
              style={{
                backgroundColor: '#0d6efd',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0b5ed7'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#0d6efd'}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
