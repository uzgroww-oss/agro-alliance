import { Component, type ReactNode, type ErrorInfo } from "react"

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div className="grid min-h-screen place-items-center px-5 text-center">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500 text-4xl font-bold">
                !
              </div>
              <h1 className="mt-6 font-display text-2xl font-extrabold">Nimadir xato ketdi</h1>
              <p className="mt-2 max-w-md text-muted">
                Kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko'ring.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green px-6 py-3 font-bold text-white shadow-lg shadow-green/30 transition-transform hover:scale-105"
              >
                Sahifani qayta yuklash
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
