import React from 'react'
import { useApp } from '../App.jsx'
import { useNav } from '../pages/MainApp.jsx'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'events', label: 'Daftar Event', icon: '📋' },
  { id: 'reports', label: 'Laporan PDF', icon: '📄' },
]

export default function Sidebar({ currentPage, onLogout }) {
  const { user } = useApp()
  const { navigate } = useNav()

  return (
    <aside style={{
      width: 240, background: 'var(--dark)',
      borderRight: '1px solid rgba(64,145,108,0.2)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(64,145,108,0.15)' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          Tournament Manager
        </div>
        <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--gold)', letterSpacing: 1, lineHeight: 1.1 }}>
          SEPAK<br />TAKRAW
        </div>
        <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 4 }}>by Syaifuddin Ali</div>
      </div>

      {/* User info */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(64,145,108,0.1)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--white)', marginBottom: 2 }}>{user?.displayName || 'Admin'}</div>
        <div style={{ fontSize: 11, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)' }}>{user?.email}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => navigate(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '11px 14px', borderRadius: 8, border: 'none',
            background: currentPage === item.id ? 'rgba(244,160,28,0.12)' : 'transparent',
            color: currentPage === item.id ? 'var(--gold)' : 'var(--gray-300)',
            fontSize: 14, fontWeight: currentPage === item.id ? 600 : 400,
            cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all 0.15s',
            fontFamily: 'var(--font-body)',
            borderLeft: currentPage === item.id ? '3px solid var(--gold)' : '3px solid transparent',
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(64,145,108,0.1)' }}>
        <button onClick={onLogout} style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '10px 14px', borderRadius: 8, border: 'none',
          background: 'transparent', color: 'var(--gray-600)', fontSize: 13,
          cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--red-card)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-600)'}
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </aside>
  )
}
