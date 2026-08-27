import React from 'react'
import { useApp } from '../App.jsx'
import { useNav } from '../pages/MainApp.jsx'
import logo from '../logo.png'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'events', label: 'Events', icon: '📋' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'reports', label: 'Results', icon: '📊' },
  { id: 'team-data', label: 'Team Data', icon: '👥' },
  { id: 'scoreboard', label: 'Scoreboard', icon: '📟' },
  { id: 'performance-analysis', label: 'Performance Analysis', icon: '📈' },
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
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,215,0,0.12)' }}>
        <img src={logo} alt="Sepaktakraw Game Management System" style={{ width: '100%', height: 'auto', display: 'block' }} />
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>By Datuk Abdul Halim Kader, BBM &amp; Syaifuddin Ali, S.Pd.</div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)' }} />
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
              <span style={{ fontSize: 17 }}>{item.icon}</span>{item.label}
            </button>
          )
        })}
      </nav>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)' }} />
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
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  )
}
