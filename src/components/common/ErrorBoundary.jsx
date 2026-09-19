import { Component } from 'react'

// Issue #41 fix: previously there was no Error Boundary anywhere in the app. React unmounts the
// ENTIRE component tree below the point of an uncaught render error — so one bad component (a
// null reference, a bad prop, a mis-shaped API response) took the whole app down to a blank white
// screen with no way to recover except a manual page reload, on any page in the app.
//
// This wraps the whole app once at the top (see App.jsx) so a crash anywhere renders a friendly,
// recoverable fallback UI instead — the person can retry or head back home instead of hitting a
// dead end. It also logs the error so problems are visible in the browser console for debugging.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[RentMyRide] Unhandled UI error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-sm w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. You can try going back to the home page.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
