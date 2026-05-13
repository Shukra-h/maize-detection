import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import LandingPage from './components/LandingPage'
import Demo from './components/Test'
import { isSupabaseConfigured, supabase } from './components/supabaseClient'

function App() {
  const [showDetector, setShowDetector] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)

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

  if (showDetector) {
    return <Demo />
  }

  return (
    <LandingPage
      authConfigured={isSupabaseConfigured}
      authLoading={authLoading}
      onLogout={handleLogout}
      onStart={() => setShowDetector(true)}
      user={session?.user ?? null}
    />
  )
}

export default App
