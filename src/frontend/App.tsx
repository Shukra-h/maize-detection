import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthControls from './components/AuthControls'
import AuthModal, { type AuthMode } from './components/AuthModal'
import LandingPage from './components/LandingPage'
import LanguageToggle from './components/LanguageToggle'
import Demo from './components/Test'
import { useI18n } from './components/i18n'
import { isSupabaseConfigured, supabase } from './components/supabaseClient'

type AppRoute = '/' | '/detection'

function getCurrentRoute(): AppRoute {
  return window.location.pathname === '/detection' ? '/detection' : '/'
}

function App() {
  const { t } = useI18n()
  const [route, setRoute] = useState<AppRoute>(() => getCurrentRoute())
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute())

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session)
        }
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const navigate = (nextRoute: AppRoute) => {
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, '', nextRoute)
    }
    setRoute(nextRoute)
  }

  const authModal = authMode ? (
    <AuthModal
      mode={authMode}
      onClose={() => setAuthMode(null)}
      onModeChange={setAuthMode}
    />
  ) : null

  if (route === '/detection') {
    return (
      <>
        <div className="detector-page">
          <nav className="detector-auth-bar" aria-label={t('detector.accountControls')}>
            <div className="detector-nav__identity">
              <button className="detector-brand-button" type="button" onClick={() => navigate('/')}>
                {t('app.brand')}
              </button>
              <span className="detector-workspace-tag">{t('app.detectorWorkspace')}</span>
            </div>
            <div className="detector-auth-actions">
              <LanguageToggle variant="detector" />
              <AuthControls
                authConfigured={isSupabaseConfigured}
                authLoading={authLoading}
                onLogin={() => setAuthMode('login')}
                onLogout={handleLogout}
                onSignup={() => setAuthMode('signup')}
                user={session?.user ?? null}
                variant="detector"
              />
            </div>
          </nav>
          <Demo />
        </div>
        {authModal}
      </>
    )
  }

  return (
    <>
      <LandingPage
        authConfigured={isSupabaseConfigured}
        authLoading={authLoading}
        onLogin={() => setAuthMode('login')}
        onLogout={handleLogout}
        onSignup={() => setAuthMode('signup')}
        onStart={() => navigate('/detection')}
        user={session?.user ?? null}
      />
      {authModal}
    </>
  )
}

export default App
