import React, { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase.js'
import AuthPage from './pages/AuthPage.jsx'
import MainApp from './pages/MainApp.jsx'
import ScoreboardDisplay from './pages/ScoreboardDisplay.jsx'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

// Standalone display mode: opened as a separate browser tab (dragged to a
// TV over HDMI) via ?display=scoreboard. Bypasses the sidebar/app chrome
// entirely and just renders the live scoreboard full-screen.
const isDisplayMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('display') === 'scoreboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const showToast = (msg, duration = 3000) => {
    setToast(msg)
    setTimeout(() => setToast(null), duration)
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      <p style={{ color: 'var(--gray-600)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Memuat...</p>
    </div>
  )

  if (isDisplayMode) {
    return (
      <AppContext.Provider value={{ user, showToast }}>
        {user ? <ScoreboardDisplay /> : (
          <div style={{ minHeight: '100vh', background: '#0a0515', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: 'var(--font-body)' }}>
            <p>Silakan login dulu di tab utama aplikasi, lalu refresh tab ini.</p>
          </div>
        )}
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={{ user, showToast }}>
      {user ? <MainApp /> : <AuthPage />}
      {toast && <div className="toast">{toast}</div>}
    </AppContext.Provider>
  )
}
