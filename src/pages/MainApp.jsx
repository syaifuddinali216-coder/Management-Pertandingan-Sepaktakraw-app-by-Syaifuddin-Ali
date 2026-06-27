import React, { useState, createContext, useContext } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useApp } from '../App.jsx'
import Sidebar from '../components/Sidebar.jsx'
import Dashboard from './Dashboard.jsx'
import Events from './Events.jsx'
import EventDetail from './EventDetail.jsx'
import Reports from './Reports.jsx'

export const NavContext = createContext(null)
export const useNav = () => useContext(NavContext)

export default function MainApp() {
  const { user, showToast } = useApp()
  const [page, setPage] = useState('dashboard') // dashboard | events | event-detail | reports
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [selectedNomorId, setSelectedNomorId] = useState(null)

  const navigate = (p, eventId = null, nomorId = null) => {
    setPage(p)
    if (eventId) setSelectedEventId(eventId)
    if (nomorId) setSelectedNomorId(nomorId)
  }

  const logout = async () => {
    await signOut(auth)
  }

  const pages = {
    dashboard: <Dashboard />,
    events: <Events />,
    'event-detail': <EventDetail eventId={selectedEventId} />,
    reports: <Reports eventId={selectedEventId} />,
  }

  return (
    <NavContext.Provider value={{ page, navigate, selectedEventId, selectedNomorId, setSelectedNomorId }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar currentPage={page} onLogout={logout} />
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto', maxHeight: '100vh' }}>
          {pages[page] || <Dashboard />}
        </main>
      </div>
    </NavContext.Provider>
  )
}
