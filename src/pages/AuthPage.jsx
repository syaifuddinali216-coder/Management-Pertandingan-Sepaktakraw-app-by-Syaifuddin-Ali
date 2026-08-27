import React, { useState } from 'react'
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'
import logo from '../logo.png'
import istafLogo from '../istaf-logo.png'

export default function AuthPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGoogleLogin = async () => {
    setLoading(true); setError('')
    try {
      await signInWithPopup(auth, googleProvider)
      // App.jsx takes over from here: checks whether this account has a
      // profile yet, and shows the Access Code gate if not.
    } catch (e) {
      setError('Google sign in failed: ' + e.message)
    }
    setLoading(false)
  }

  const handleEmailLogin = async () => {
    if (!form.email || !form.password) return setError('Email and password are required.')
    setLoading(true); setError('')
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password)
    } catch (e) {
      setError('Incorrect email or password.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: `radial-gradient(ellipse at top, rgba(106,47,160,0.25) 0%, transparent 60%), var(--darker)`,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src={logo} alt="Sepaktakraw Game Management System" style={{ width: '100%', maxWidth: 340, height: 'auto', marginBottom: 4, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
          <p style={{ fontSize: 8.5, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
            By Datuk Abdul Halim Kader, BBM &amp; Syaifuddin Ali, S.Pd.
          </p>
        </div>

        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src={istafLogo} alt="ISTAF - International Sepaktakraw Federation" style={{ width: '100%', maxWidth: 230, height: 'auto', marginBottom: 16, display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            <div style={{
              display: 'inline-block', padding: '8px 30px', borderRadius: 999,
              border: '1.5px solid rgba(255,215,0,0.5)', background: 'rgba(255,215,0,0.08)',
            }}>
              <h2 style={{ fontSize: 26, fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: 2, margin: 0 }}>SIGN IN</h2>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.35), transparent)', marginTop: 20 }} />
          </div>

          {error && (
            <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid var(--red-card)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red-card)' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="email@kamu.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Your password" value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmailLogin()} />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginBottom: 12 }}
            onClick={handleEmailLogin} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <button onClick={handleGoogleLogin} disabled={loading} style={{
            width: '100%', padding: '13px', border: '1px solid rgba(64,145,108,0.3)', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', color: 'var(--white)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(64,145,108,0.3)'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.88v2.08A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.51 10.53c-.16-.48-.25-.99-.25-1.53s.09-1.05.25-1.53V5.39H1.88A8 8 0 0 0 .98 9c0 1.29.31 2.51.9 3.61l2.63-2.08z"/>
              <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.1 4.39l2.63 2.08c.63-1.89 2.39-3.29 4.47-3.29z"/>
            </svg>
            Sign In dengan Google
          </button>
          <p style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 10, textAlign: 'center' }}>
            First time here? Sign in with Google, then enter the Access Code when prompted.
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-600)', marginTop: 24, fontFamily: 'var(--font-mono)' }}>
          © 2026 Game Management System
        </p>
      </div>
    </div>
  )
}
