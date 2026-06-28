import React from 'react'
import { useApp } from '../App.jsx'
import { useNav } from '../pages/MainApp.jsx'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'events', label: 'Daftar Event', icon: '📋' },
  { id: 'reports', label: 'Rekap Hasil', icon: '📊' },
]

export default function Sidebar({ currentPage, onLogout }) {
  const { user } = useApp()
  const { navigate } = useNav()

  return (
    <aside style={{
      width: 240, background: 'var(--bg-sidebar)',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          Tournament Manager
        </div>
        <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: 1, lineHeight: 1.1 }}>
          SEPAK<br />TAKRAW
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>by Syaifuddin Ali</div>
      </div>

      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{user?.displayName || 'Admin'}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>{user?.email}</div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '11px 14px', borderRadius: 8, border: 'none',
            background: currentPage === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
            color: currentPage === item.id ? '#fff' : 'rgba(255,255,255,0.55)',
            fontSize: 14, fontWeight: currentPage === item.id ? 600 : 400,
            cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
            borderLeft: currentPage === item.id ? '3px solid #7dffb0' : '3px solid transparent',
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', borderRadius: 8, border: 'none',
          background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13,
          cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#ff8080'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </aside>
  )
}
