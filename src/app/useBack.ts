import { useLocation, useNavigate } from 'react-router'

/**
 * In-app "back": steps back in history when we got here from inside the app,
 * otherwise replaces the entry. Either way the system back button never bounces
 * between screens.
 */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if ((location.state as { fromApp?: boolean } | null)?.fromApp) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
