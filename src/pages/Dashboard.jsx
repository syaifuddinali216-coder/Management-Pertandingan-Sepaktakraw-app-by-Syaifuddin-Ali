import React from 'react'
import { useApp } from '../App.jsx'
import { useNav } from './MainApp.jsx'
import { useEvents } from '../hooks/useFirestore.js'

export default function Dashboard() {
  const { user } = useApp()
  const { navigate } = useNav()
  const { events, loading } = useEvents()

  const activeEvents = events.filter(e => e.status !== 'selesai').length
  const doneEvents = events.filter(e => e.status === 'selesai').length

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div className="tag-line" style={{ marginBottom: 8 }}>Selamat Datang</div>
        <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>DASHBOARD</h1>
        <p style={{ color: 'var(--gray-600)', fontSize: 14, marginTop: 4 }}>
          Halo, <strong style={{ color: 'var(--white)' }}>{user?.displayName}</strong> 👋 Selamat mengelola turnamen sepak takraw!
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Event', value: loading ? '...' : events.length, icon: '📋', color: 'var(--green-accent)' },
          { label: 'Event Aktif', value: loading ? '...' : activeEvents, icon: '⚡', color: 'var(--gold)' },
          { label: 'Event Selesai', value: loading ? '...' : doneEvents, icon: '✅', color: 'var(--green-bright)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 40, fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent events */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, color: 'var(--white)' }}>EVENT TERBARU</h2>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => navigate('events')}>
            Lihat Semua
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>Belum ada event. Buat event pertama kamu!</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('events')}>+ Buat Event Baru</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.slice(0, 5).map(ev => (
              <div key={ev.id}
                onClick={() => navigate('event-detail', ev.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(64,145,108,0.15)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(64,145,108,0.15)'}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ev.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                    {ev.location || '—'} · {ev.date ? new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`badge ${ev.status === 'selesai' ? 'badge-gold' : ev.status === 'berlangsung' ? 'badge-green' : 'badge-gray'}`}>
                    {ev.status === 'selesai' ? 'Selesai' : ev.status === 'berlangsung' ? 'Berlangsung' : 'Persiapan'}
                  </span>
                  <span style={{ color: 'var(--gray-600)' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Guide */}
      <div className="card">
        <h2 style={{ fontSize: 22, color: 'var(--white)', marginBottom: 20 }}>CARA PENGGUNAAN</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { step: '01', title: 'Buat Event Baru', desc: 'Klik "Daftar Event" → "+ Buat Event". Isi nama turnamen, lokasi, dan tanggal.' },
            { step: '02', title: 'Tambah Nomor Pertandingan', desc: 'Buka event → tambah nomor (Regu Putra, Double Putri, dll) sesuai kebutuhan.' },
            { step: '03', title: 'Input Tim & Atlet', desc: 'Per nomor pertandingan, daftarkan kontingen, atlet, manager, dan official.' },
            { step: '04', title: 'Atur Grup & Jadwal', desc: 'Bagi tim ke dalam pool/grup, lalu input skor per set (maks 15, deuce 17).' },
            { step: '05', title: 'Generate Laporan PDF', desc: 'Setelah selesai, cetak laporan PDF lengkap dengan cover, hasil, dan statistik.' },
          ].map((item, i, arr) => (
            <div key={i} style={{
              display: 'flex', gap: 16, padding: '14px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--gold)', minWidth: 36, lineHeight: 1 }}>{item.step}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
