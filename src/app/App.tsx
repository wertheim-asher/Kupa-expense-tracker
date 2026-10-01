import { APP } from '../config.ts'
import { t } from '../i18n/index.ts'

export function App() {
  return (
    <main className="mx-auto max-w-[480px] p-4">
      <h1 className="text-4xl font-bold">{APP.name}</h1>
      <p className="text-muted">{t('welcome.tagline')}</p>
    </main>
  )
}
