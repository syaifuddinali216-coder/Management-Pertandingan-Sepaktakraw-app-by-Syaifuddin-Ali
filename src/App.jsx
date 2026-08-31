import React, { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import AuthPage from './pages/AuthPage.jsx'
import MainApp from './pages/MainApp.jsx'
import ScoreboardDisplay from './pages/ScoreboardDisplay.jsx'
import EventTVDisplay from './pages/EventTVDisplay.jsx'
import logo from './logo.png'
import istafLogo from './istaf-logo.png'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

const SECRET_CODE = 'Sepaktakraw Indonesia'

// Standalone display mode: opened as a separate browser tab (dragged to a
// TV over HDMI) via ?display=scoreboard or ?display=event&eventId=xxx.
// Bypasses the sidebar/app chrome entirely and just renders full-screen.
const displayParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const isScoreboardDisplay = displayParams?.get('display') === 'scoreboard'
const isEventDisplay = displayParams?.get('display') === 'event'
const eventDisplayId = displayParams?.get('eventId') || null

// Shown when someone has just passed Google Sign-In but doesn't have an
// app profile yet — they're held here (never touching the Dashboard) until
// they enter a valid Access Code, or cancel and get signed back out.
function AccessCodeGate({ pendingUser, onSubmit, onCancel, loading, error }) {
  const [code, setCode] = useState('')
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: `radial-gradient(ellipse at top, rgba(106,47,160,0.25) 0%, transparent 60%), var(--darker)`,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src={logo} alt="Sepaktakraw Game Management System" style={{ width: '100%', maxWidth: 340, height: 'auto', marginBottom: 4, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
          <p style={{ fontSize: 8.5, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
            By Datuk Abdul Halim Kader, BBM &amp; Syaifuddin Ali, S.Pd.
          </p>
        </div>

        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <img src={istafLogo} alt="ISTAF - International Sepaktakraw Federation" style={{ width: '100%', maxWidth: 230, height: 'auto', marginBottom: 16, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            <div style={{
              display: 'inline-block', padding: '8px 22px', borderRadius: 12,
              border: '1.5px solid rgba(255,215,0,0.5)', background: 'rgba(255,215,0,0.08)',
            }}>
              <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: 1.5, margin: 0 }}>ACCESS CODE REQUIRED</h2>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.35), transparent)', marginTop: 20, marginBottom: 16 }} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', textAlign: 'center', marginBottom: 20 }}>
            Signed in as <strong style={{ color: 'var(--gold)' }}>{pendingUser?.email}</strong>. This looks like your first time here — enter the Access Code to continue.
          </p>

          {error && (
            <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid var(--red-card)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red-card)' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Access Code</label>
            <input
              type="text" placeholder="Enter access code" value={code} autoFocus
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit(code)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '13px', fontSize: 15 }}
              onClick={() => onSubmit(code)} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Continue'}
            </button>
            <button className="btn btn-ghost" style={{ padding: '13px 18px' }} onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-600)', marginTop: 24, fontFamily: 'var(--font-mono)' }}>
          © 2026 Game Management System
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [pendingUser, setPendingUser] = useState(null) // authenticated with Google/Firebase, but no app profile yet
  const [authLoading, setAuthLoading] = useState(true)
  const [gateLoading, setGateLoading] = useState(false)
  const [gateError, setGateError] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null); setPendingUser(null); setAuthLoading(false); return
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid))
        if (snap.exists()) {
          setUser(u); setPendingUser(null)
        } else {
          setUser(null); setPendingUser(u)
        }
      } catch (e) {
        console.error('Profile check failed:', e)
        setUser(null); setPendingUser(u)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const handleGateSubmit = async (code) => {
    if (!pendingUser) return
    if (code !== SECRET_CODE) { setGateError('Invalid access code. Contact administrator.'); return }
    setGateLoading(true); setGateError('')
    try {
      await setDoc(doc(db, 'users', pendingUser.uid), {
        name: pendingUser.displayName || pendingUser.email,
        email: pendingUser.email,
        createdAt: new Date().toISOString(),
      })
      setUser(pendingUser)
      setPendingUser(null)
    } catch (e) {
      setGateError('Failed to create profile: ' + e.message)
    }
    setGateLoading(false)
  }

  const handleGateCancel = async () => {
    setGateError('')
    await auth.signOut()
  }

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

  if (pendingUser) {
    return (
      <AccessCodeGate
        pendingUser={pendingUser}
        onSubmit={handleGateSubmit}
        onCancel={handleGateCancel}
        loading={gateLoading}
        error={gateError}
      />
    )
  }

  if (isScoreboardDisplay || isEventDisplay) {
    return (
      <AppContext.Provider value={{ user, showToast }}>
        {user ? (
          isEventDisplay ? <EventTVDisplay eventId={eventDisplayId} /> : <ScoreboardDisplay />
        ) : (
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
