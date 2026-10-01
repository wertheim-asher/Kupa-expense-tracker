import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n/index.ts'
import { Button } from '../ui/Button.tsx'

interface Props {
  onReset: () => void
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept for debugging on a real device; normal use never reaches this.
    console.error(error, info.componentStack)
  }

  private retry = () => {
    this.setState({ failed: false })
    this.props.onReset()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorState onRetry={this.retry} />
  }
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">{t('error.title')}</h1>
      <p className="text-muted">{message ?? t('error.body')}</p>
      <Button onClick={onRetry} className="mt-4">
        {t('common.retry')}
      </Button>
    </main>
  )
}
