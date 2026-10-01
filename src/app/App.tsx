import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import type { Mode } from '../data/mode.ts'
import { AddSheet } from '../features/add-expense/AddSheet.tsx'
import { EditSheet } from '../features/edit-expense/EditSheet.tsx'
import { Home, HomeSkeleton } from '../features/home/Home.tsx'
import { Create } from '../features/onboarding/Create.tsx'
import { Welcome } from '../features/onboarding/Welcome.tsx'
import { Settings } from '../features/settings/Settings.tsx'
import { t } from '../i18n/index.ts'
import { ToastProvider } from '../ui/Toast.tsx'
import { DataProvider, useData } from './DataProvider.tsx'
import { ErrorBoundary, ErrorState } from './ErrorBoundary.tsx'
import { ModeProvider, useMode } from './ModeContext.tsx'

export function App({ initialMode }: { initialMode: Mode }) {
  return (
    <BrowserRouter>
      <ModeProvider initial={initialMode}>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </ModeProvider>
    </BrowserRouter>
  )
}

function Root() {
  const { mode } = useMode()
  // Bumping the key remounts the data layer, which reloads everything ("Try again").
  const [resetKey, setResetKey] = useState(0)
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col pt-[env(safe-area-inset-top)]">
      {mode === 'demo' && <DemoBanner />}
      <ErrorBoundary onReset={() => setResetKey((k) => k + 1)}>
        <DataProvider key={`${mode}-${resetKey}`}>
          <AppRoutes />
        </DataProvider>
      </ErrorBoundary>
    </div>
  )
}

function DemoBanner() {
  return (
    <p className="bg-warn-soft px-4 py-1.5 text-center text-sm font-medium text-warn" role="note">
      {t('demo.banner')}
    </p>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/welcome"
        element={
          <SignedOutOnly>
            <Welcome />
          </SignedOutOnly>
        }
      />
      <Route
        path="/create"
        element={
          <SignedOutOnly>
            <Create />
          </SignedOutOnly>
        }
      />
      <Route
        path="/"
        element={
          <RequireSession>
            <Home />
          </RequireSession>
        }
      >
        <Route path="add" element={<AddSheet />} />
        <Route path="expense/:id" element={<EditSheet />} />
      </Route>
      <Route
        path="/settings"
        element={
          <RequireSession>
            <Settings />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RequireSession({ children }: { children: ReactNode }) {
  const { status, refresh } = useData()
  if (status === 'loading') return <HomeSkeleton />
  if (status === 'error') return <ErrorState onRetry={() => void refresh()} message={t('home.loadError')} />
  if (status === 'no-session') return <Navigate to="/welcome" replace />
  return children
}

function SignedOutOnly({ children }: { children: ReactNode }) {
  const { status, refresh } = useData()
  if (status === 'loading') return <HomeSkeleton />
  if (status === 'error') return <ErrorState onRetry={() => void refresh()} message={t('home.loadError')} />
  if (status === 'ready') return <Navigate to="/" replace />
  return children
}
