import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import AuthControls from './components/AuthControls'
import AuthModal, { type AuthMode } from './components/AuthModal'
import LandingPage from './components/LandingPage'
import LanguageToggle from './components/LanguageToggle'
import Demo from './components/Test'
import { useI18n } from './components/i18n'
import { isSupabaseConfigured, supabase } from './components/supabaseClient'

interface SharedAuthProps {
  authConfigured: boolean
  authLoading: boolean
  onLogin: () => void
  onLogout: () => void
  onSignup: () => void
  session: Session | null
}

function LandingRoute({
  authConfigured,
  authLoading,
  onLogin,
  onLogout,
  onSignup,
  session,
}: SharedAuthProps) {
  const navigate = useNavigate()

  return (
    <LandingPage
      authConfigured={authConfigured}
      authLoading={authLoading}
      onLogin={onLogin}
      onLogout={onLogout}
      onSignup={onSignup}
      onStart={() => navigate('/detection')}
      user={session?.user ?? null}
    />
  )
}

function DetectorNav({
  authConfigured,
  authLoading,
  onLogin,
  onLogout,
  onSignup,
  session,
}: SharedAuthProps) {
  const { t } = useI18n()

  return (
    <nav className="detector-auth-bar" aria-label={t('detector.accountControls')}>
      <div className="detector-nav__identity">
        <Link className="detector-brand-button" to="/">
          {t('app.brand')}
        </Link>
        <span className="detector-workspace-tag">{t('app.detectorWorkspace')}</span>
      </div>
      <div className="detector-auth-actions">
        <LanguageToggle variant="detector" />
        <AuthControls
          authConfigured={authConfigured}
          authLoading={authLoading}
          onLogin={onLogin}
          onLogout={onLogout}
          onSignup={onSignup}
          user={session?.user ?? null}
          variant="detector"
        />
      </div>
    </nav>
  )
}

function DetectionAuthGate({
  authConfigured,
  authLoading,
  onLogin,
  onSignup,
}: Pick<SharedAuthProps, 'authConfigured' | 'authLoading' | 'onLogin' | 'onSignup'>) {
  const { t } = useI18n()

  const title = authLoading
    ? t('detector.authCheckingTitle')
    : authConfigured
      ? t('detector.authRequiredTitle')
      : t('detector.authMissingTitle')

  const copy = authLoading
    ? t('detector.authCheckingCopy')
    : authConfigured
      ? t('detector.authRequiredCopy')
      : t('detector.authMissingCopy')

  return (
    <section className="detector-auth-gate" aria-labelledby="detector-auth-gate-title">
      <div className="detector-auth-gate__card">
        <p className="landing-kicker">{t('app.detectorWorkspace')}</p>
        <h1 id="detector-auth-gate-title">{title}</h1>
        <p>{copy}</p>

        {!authLoading && authConfigured && (
          <div className="detector-auth-gate__actions">
            <button className="landing-primary" type="button" onClick={onLogin}>
              {t('auth.login')}
            </button>
            <button className="detector-auth-button" type="button" onClick={onSignup}>
              {t('auth.signup')}
            </button>
          </div>
        )}

        <Link className="detector-auth-gate__home" to="/">
          {t('detector.backHome')}
        </Link>
      </div>
    </section>
  )
}

function DetectionRoute(props: SharedAuthProps) {
  const { authConfigured, authLoading, session, onLogin, onSignup } = props

  return (
    <div className="detector-page">
      <DetectorNav {...props} />
      {authLoading || !authConfigured || !session ? (
        <DetectionAuthGate
          authConfigured={authConfigured}
          authLoading={authLoading}
          onLogin={onLogin}
          onSignup={onSignup}
        />
      ) : (
        <Demo />
      )}
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)

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

  const authModal = authMode ? (
    <AuthModal
      mode={authMode}
      onClose={() => setAuthMode(null)}
      onModeChange={setAuthMode}
    />
  ) : null

  const sharedAuthProps: SharedAuthProps = {
    authConfigured: isSupabaseConfigured,
    authLoading,
    onLogin: () => setAuthMode('login'),
    onLogout: handleLogout,
    onSignup: () => setAuthMode('signup'),
    session,
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingRoute {...sharedAuthProps} />} />
        <Route path="/detection" element={<DetectionRoute {...sharedAuthProps} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {authModal}
    </>
  )
}

export default App
