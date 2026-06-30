import React, { useState, createContext, useContext, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useApp } from '../App.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Dashboard from './Dashboard.jsx'
import Events from './Events.jsx'
import EventDetail from './EventDetail.jsx'
import Reports from './Reports.jsx'
import Schedule from './Schedule.jsx'

export const NavContext = createContext(null)
export const useNav = () => useContext(NavContext)

export default function MainApp() {
  const { user, showToast } = useApp()
  const [page, setPage] = useState('dashboard') // dashboard | events | event-detail | reports
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [selectedNomorId, setSelectedNomorId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900)

  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  useEffect(() => {
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      // Ignore mostly-vertical swipes (scrolling)
      if (Math.abs(dy) > Math.abs(dx)) { touchStartX.current = null; return }
      // Swipe right from near left edge → open
      if (!sidebarOpen && touchStartX.current < 40 && dx > 60) setSidebarOpen(true)
      // Swipe left anywhere while open → close
      if (sidebarOpen && dx < -60) setSidebarOpen(false)
      touchStartX.current = null
    }
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [sidebarOpen])

  const navigate = (p, eventId = null, nomorId = null) => {
    setPage(p)
    if (eventId) setSelectedEventId(eventId)
    if (nomorId) setSelectedNomorId(nomorId)
    if (window.innerWidth <= 900) setSidebarOpen(false)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const pages = {
    dashboard: <Dashboard />,
    events: <Events />,
    'event-detail': <EventDetail eventId={selectedEventId} />,
    reports: <Reports eventId={selectedEventId} />,
    schedule: <Schedule eventId={selectedEventId} />,
  }

  return (
    <NavContext.Provider value={{ page, navigate, selectedEventId, selectedNomorId, setSelectedNomorId }}>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        {/* Overlay for mobile when sidebar open */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 90, display: 'none',
            }}
            className="sidebar-overlay"
          />
        )}

        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}>
          <Sidebar currentPage={page} onLogout={logout} />
        </div>

        {/* Toggle handle - always visible */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle menu"
          style={{
            position: 'fixed', top: 16,
            left: sidebarOpen ? 252 : 12,
            zIndex: 110,
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.4)',
            color: '#FFD700', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'left 0.25s ease',
            backdropFilter: 'blur(4px)',
          }}
        >
          ☰
        </button>

        <main style={{
          flex: 1, padding: '32px', paddingLeft: sidebarOpen ? '32px' : '64px',
          overflowY: 'auto', maxHeight: '100vh', width: '100%',
          marginLeft: sidebarOpen ? 240 : 0,
          transition: 'margin-left 0.25s ease, padding-left 0.25s ease',
        }}>
          {pages[page] || <Dashboard />}
        </main>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .sidebar-overlay { display: block !important; }
          main { margin-left: 0 !important; }
        }
      `}</style>
    </NavContext.Provider>
  )
}
