import React from 'react'
import { useApp } from '../App.jsx'
import { useNav } from '../pages/MainApp.jsx'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'events', label: 'Daftar Event', icon: '📋' },
  { id: 'schedule', label: 'Jadwal', icon: '📅' },
  { id: 'reports', label: 'Rekap Hasil', icon: '📊' },
]

export default function Sidebar({ currentPage, onLogout }) {
  const { user } = useApp()
  const { navigate } = useNav()

  return (
    <aside style={{
      width: 240, height: '100vh',
      background: 'linear-gradient(180deg, #0f0620 0%, #1a0a2e 40%, #2d1052 100%)',
      borderRight: '1px solid rgba(255,215,0,0.15)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      boxShadow: '4px 0 30px rgba(0,0,0,0.4)',
    }}>
      {/* Brand */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,215,0,0.12)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,215,0,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Tournament Manager
        </div>
        <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', lineHeight: 1.1, letterSpacing: 1 }}>
          <span style={{ background: 'linear-gradient(135deg, #FFD700, #B8860B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SEPAK<br />TAKRAW
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6, fontStyle: 'italic' }}>by Syaifuddin Ali</div>
      </div>

      {/* Gold divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)', margin: '0' }} />

      {/* User */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #FFD700, #B8860B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a0a2e', flexShrink: 0 }}>
            {(user?.displayName || 'A')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 1 }}>{user?.displayName || 'Admin'}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 10px' }}>
        {navItems.map(item => {
          const isActive = currentPage === item.id
          return (
            <button key={item.id} onClick={() => navigate(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '11px 14px', borderRadius: 10, border: 'none',
              background: isActive ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))' : 'transparent',
              color: isActive ? '#FFD700' : 'rgba(255,255,255,0.55)',
              fontSize: 14, fontWeight: isActive ? 700 : 400,
              cursor: 'pointer', textAlign: 'left', marginBottom: 4, transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
              borderLeft: isActive ? '3px solid #FFD700' : '3px solid transparent',
              boxShadow: isActive ? '0 2px 12px rgba(255,215,0,0.15)' : 'none',
            }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,215,0,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Bottom decoration */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)' }} />

      {/* Logout */}
      <div style={{ padding: '14px 10px' }}>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', borderRadius: 10, border: 'none',
          background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 13,
          cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff9999'; e.currentTarget.style.background = 'rgba(255,107,107,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </aside>
  )
}
