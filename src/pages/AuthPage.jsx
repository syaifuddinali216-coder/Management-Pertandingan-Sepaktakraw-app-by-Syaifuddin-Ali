import React, { useState } from 'react'
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase.js'
import logo from '../assets/logo.png'

const SECRET_CODE = 'Sepaktakraw Indonesia'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | register
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGoogleLogin = async () => {
    setLoading(true); setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      // Check if new user — if so, verify code
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (!snap.exists()) {
        // New Google user — need code
        const code = prompt('Sign Inkan Access Code untuk mendaftar:')
        if (code !== SECRET_CODE) {
          await auth.signOut()
          setError('Invalid access code. Contact administrator.')
          setLoading(false); return
        }
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName,
          email: user.email,
          createdAt: new Date().toISOString(),
        })
      }
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
      setError('Email or password salah.')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) return setError('All fields are required.')
    if (form.code !== SECRET_CODE) return setError('Invalid access code. Contact administrator.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true); setError('')
    try {
      const result = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(result.user, { displayName: form.name })
      await setDoc(doc(db, 'users', result.user.uid), {
        name: form.name, email: form.email, createdAt: new Date().toISOString(),
      })
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setError('Email already registered.')
      else setError('Registration failed: ' + e.message)
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
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src={logo} alt="Sepaktakraw Game Management System" style={{ width: '100%', maxWidth: 340, height: 'auto', marginBottom: 10 }} />
          <p style={{ fontSize: 12, color: 'var(--green-accent)', fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>
            by Syaifuddin Ali
          </p>
        </div>

        <div className="card">
          {/* Tab */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 4 }}>
            {[['login','Sign In'],['register','Register']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
                background: mode === m ? 'var(--green-mid)' : 'transparent',
                color: mode === m ? 'var(--white)' : 'var(--gray-600)',
              }}>{label}</button>
            ))}
          </div>

          {error && (
            <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid var(--red-card)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red-card)' }}>
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div className="form-group">
              <label>Full Name</label>
              <input placeholder="Nama kamu" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="email@kamu.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'} value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleEmailLogin() : handleRegister())} />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label>Access Code</label>
              <input placeholder="Sign Inkan kode kunci pendaftaran" value={form.code} onChange={e => set('code', e.target.value)} />
              <p style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 4 }}>Contact Syaifuddin Ali to obtain the access code.</p>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginBottom: 12 }}
            onClick={mode === 'login' ? handleEmailLogin : handleRegister} disabled={loading}>
            {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Register Sekarang'}
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
            {mode === 'login' ? 'Sign In dengan Google' : 'Register dengan Google'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-600)', marginTop: 24, fontFamily: 'var(--font-mono)' }}>
          © 2025 Syaifuddin Ali · Sepaktakraw Game Management System
        </p>
      </div>
    </div>
  )
}
