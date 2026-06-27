import React, { useState } from 'react'
import { useApp } from '../App.jsx'
import { useNav } from './MainApp.jsx'
import { useEvents, useNomors, useTeams, useMatches } from '../hooks/useFirestore.js'

// Helper: get all teams & matches for a nomor (we'll fetch inline via hooks below)
// We build PDF from pre-fetched data passed in

function calcSetResult(sets) {
  let hw = 0, aw = 0
  ;(sets || []).forEach(s => {
    const h = parseInt(s?.home) || 0, a = parseInt(s?.away) || 0
    if (!h && !a) return
    if (h > a) hw++; else if (a > h) aw++
  })
  return { homeSetWins: hw, awaySetWins: aw }
}

function calcStandings(teams, matches) {
  const tbl = {}
  teams.forEach(t => tbl[t.id] = { name: t.name, P: 0, W: 0, L: 0, SetW: 0, SetL: 0, Pts: 0 })
  matches.filter(m => m.status === 'done').forEach(m => {
    const h = tbl[m.homeId], a = tbl[m.awayId]
    if (!h || !a) return
    const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(m.sets)
    h.P++; a.P++; h.SetW += hw; h.SetL += aw; a.SetW += aw; a.SetL += hw
    if (hw > aw) { h.W++; h.Pts += 3; a.L++ }
    else if (aw > hw) { a.W++; a.Pts += 3; h.L++ }
    else { h.Pts++; a.Pts++ }
  })
  return Object.values(tbl).sort((a, b) => b.Pts - a.Pts || (b.SetW - b.SetL) - (a.SetW - a.SetL))
}

// Sub-component that loads data for one nomor
function NomorDataLoader({ eventId, nomor, onData }) {
  const { teams } = useTeams(eventId, nomor.id)
  const { matches } = useMatches(eventId, nomor.id)
  React.useEffect(() => { onData(nomor.id, teams, matches) }, [teams, matches])
  return null
}

export default function Reports({ eventId: initialEventId }) {
  const { user, showToast } = useApp()
  const { navigate } = useNav()
  const { events } = useEvents()
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || null)
  const [generating, setGenerating] = useState(false)
  const [nomorData, setNomorData] = useState({})

  const eventId = selectedEventId
  const { nomors } = useNomors(eventId)
  const event = events.find(e => e.id === eventId)

  const handleNomorData = (nomorId, teams, matches) => {
    setNomorData(prev => ({ ...prev, [nomorId]: { teams, matches } }))
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const fmtTime = (t) => t || ''

  const generatePDF = async () => {
    if (!event) return showToast('Pilih event terlebih dahulu.')
    setGenerating(true)
    showToast('Membuat PDF laporan lengkap...')

    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const ML = 15, MR = 15
      const CW = W - ML - MR
      const now = new Date()

      // ─────────────────────────────────────────────────
      // HALAMAN 1: COVER
      // ─────────────────────────────────────────────────
      doc.setFillColor(13, 27, 18)
      doc.rect(0, 0, W, H, 'F')

      // Green accent top bar
      doc.setFillColor(45, 106, 79)
      doc.rect(0, 0, W, 8, 'F')
      doc.setFillColor(244, 160, 28)
      doc.rect(0, 6, W, 2, 'F')

      // Logo area
      doc.setFontSize(60)
      doc.text('🏆', W / 2, 70, { align: 'center' })

      // Title
      doc.setTextColor(244, 160, 28)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text('LAPORAN AKHIR PERTANDINGAN', W / 2, 95, { align: 'center' })

      doc.setFontSize(14)
      doc.setTextColor(82, 183, 136)
      doc.text('SEPAK TAKRAW', W / 2, 106, { align: 'center' })

      // Event name box
      doc.setFillColor(26, 71, 42)
      doc.roundedRect(ML, 116, CW, 30, 4, 4, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      const eventName = doc.splitTextToSize(event.name, CW - 10)
      doc.text(eventName, W / 2, 128, { align: 'center' })

      // Info
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 220, 200)
      let infoY = 158
      if (event.organizer) { doc.text(`Penyelenggara: ${event.organizer}`, W / 2, infoY, { align: 'center' }); infoY += 8 }
      if (event.location) { doc.text(`Lokasi: ${event.location}`, W / 2, infoY, { align: 'center' }); infoY += 8 }
      if (event.date) { doc.text(`Tanggal: ${fmtDate(event.date)}`, W / 2, infoY, { align: 'center' }); infoY += 8 }
      doc.text(`Jumlah Nomor Pertandingan: ${nomors.length}`, W / 2, infoY, { align: 'center' })

      // Bottom decoration
      doc.setFillColor(45, 106, 79)
      doc.rect(0, H - 30, W, 30, 'F')
      doc.setTextColor(244, 160, 28)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('TURNAMEN MANAGER SEPAK TAKRAW', W / 2, H - 18, { align: 'center' })
      doc.setTextColor(180, 210, 190)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('by Syaifuddin Ali', W / 2, H - 10, { align: 'center' })

      // ─────────────────────────────────────────────────
      // HALAMAN 2: PEMBUKAAN
      // ─────────────────────────────────────────────────
      doc.addPage()
      let y = 20

      const sectionHeader = (title, color = [26, 71, 42]) => {
        doc.setFillColor(...color)
        doc.rect(ML, y, CW, 10, 'F')
        doc.setTextColor(244, 160, 28)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(title, ML + 5, y + 7)
        doc.setTextColor(30, 30, 30)
        y += 16
      }

      const checkPage = (needed = 30) => {
        if (y + needed > H - 20) { doc.addPage(); y = 20 }
      }

      sectionHeader('KATA PEMBUKAAN')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(40, 40, 40)
      const pembukaanText = event.pembukaan ||
        `Puji syukur kami panjatkan ke hadirat Tuhan Yang Maha Esa atas terselenggaranya ${event.name} dengan lancar dan sukses.\n\nKejuaraan ini merupakan wujud nyata komitmen kami dalam pengembangan olahraga sepak takraw di Indonesia. Melalui ajang bergengsi ini, kami berharap dapat menjaring bibit-bibit atlet berbakat yang kelak akan mengharumkan nama bangsa di kancah nasional maupun internasional.\n\nKami mengucapkan terima kasih kepada seluruh kontingen, wasit, panitia, dan semua pihak yang telah mendukung terselenggaranya kejuaraan ini. Semoga laporan ini dapat menjadi dokumentasi yang bermanfaat bagi perkembangan olahraga sepak takraw ke depannya.`
      const splitPembukaan = doc.splitTextToSize(pembukaanText, CW)
      doc.text(splitPembukaan, ML, y)
      y += splitPembukaan.length * 6 + 16

      // TTD area
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(`${event.location || 'Indonesia'}, ${fmtDate(event.date)}`, W - MR - 60, y, { align: 'right' })
      y += 6
      doc.text('Panitia Pelaksana', W - MR - 60, y, { align: 'right' })
      y += 24
      doc.text(event.organizer || 'Panitia Turnamen', W - MR - 60, y, { align: 'right' })
      y += 20

      // ─────────────────────────────────────────────────
      // HALAMAN 3: JADWAL PERTANDINGAN
      // ─────────────────────────────────────────────────
      checkPage(40)
      sectionHeader('JADWAL PERTANDINGAN')

      nomors.forEach((nomor, ni) => {
        checkPage(30)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(26, 71, 42)
        doc.text(`${ni + 1}. ${nomor.name}`, ML, y)
        y += 6

        const nd = nomorData[nomor.id]
        const nMatches = nd?.matches || []
        const doneM = nMatches.filter(m => m.status === 'done')
        const pendingM = nMatches.filter(m => m.status !== 'done')

        if (nMatches.length === 0) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
          doc.text('Belum ada jadwal.', ML + 4, y); y += 8
          return
        }

        const rows = nMatches.map(m => {
          const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(m.sets)
          const ht = nd?.teams.find(t => t.id === m.homeId)?.name || '—'
          const at = nd?.teams.find(t => t.id === m.awayId)?.name || '—'
          return [
            m.date ? fmtDate(m.date) : '—',
            fmtTime(m.time) || '—',
            m.groupName || 'Knockout',
            ht,
            m.status === 'done' ? `${hw}-${aw}` : 'vs',
            at,
            m.status === 'done' ? (hw > aw ? ht : at) : '—',
          ]
        })

        checkPage(20 + rows.length * 7)
        autoTable(doc, {
          startY: y,
          head: [['Tanggal', 'Waktu', 'Pool', 'Tim A', 'Set', 'Tim B', 'Pemenang']],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [45, 106, 79], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 247] },
          margin: { left: ML, right: MR },
          columnStyles: { 3: { cellWidth: 35 }, 5: { cellWidth: 35 }, 4: { halign: 'center', cellWidth: 14 } },
        })
        y = doc.lastAutoTable.finalY + 10
      })

      // ─────────────────────────────────────────────────
      // HALAMAN: DAFTAR ISI
      // ─────────────────────────────────────────────────
      checkPage(60)
      sectionHeader('DAFTAR ISI')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(40, 40, 40)
      const tocItems = [
        'Kata Pembukaan',
        'Jadwal Pertandingan',
        'Daftar Isi',
        'Daftar Pemenang Kejuaraan',
        ...nomors.flatMap((n, i) => [
          `Nomor ${i + 1}: ${n.name}`,
          `  └ Daftar Kontingen Peserta`,
          `  └ Daftar Atlet, Manager & Official`,
          `  └ Pembagian Pool`,
          `  └ Official Result`,
        ]),
        'Kata Penutup',
      ]
      tocItems.forEach((item, i) => {
        checkPage(8)
        doc.setFont('helvetica', item.startsWith('  └') ? 'normal' : 'bold')
        doc.setTextColor(item.startsWith('  └') ? 80 : 30, item.startsWith('  └') ? 80 : 30, item.startsWith('  └') ? 80 : 30)
        doc.text(item, ML, y)
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'normal')
        doc.text('..........', W / 2, y)
        y += 7
      })
      y += 10

      // ─────────────────────────────────────────────────
      // HALAMAN: DAFTAR PEMENANG KEJUARAAN
      // ─────────────────────────────────────────────────
      doc.addPage(); y = 20
      sectionHeader('DAFTAR PEMENANG KEJUARAAN', [13, 27, 18])

      // Gold medal header
      doc.setFillColor(244, 160, 28)
      doc.rect(ML, y, CW, 1, 'F')
      y += 6

      const champRows = nomors.map((nomor, i) => {
        const nd = nomorData[nomor.id]
        const allMatches = nd?.matches || []
        const teams = nd?.teams || []

        // Find champion from knockout or best group standing
        const koFinal = allMatches.find(m => m.phase === 'knockout' && m.round === 1 && m.status === 'done')
        let champ = '—', runner = '—', third = '—'

        if (koFinal) {
          const cid = koFinal.winnerId
          const rid = cid === koFinal.homeId ? koFinal.awayId : koFinal.homeId
          champ = teams.find(t => t.id === cid)?.name || '—'
          runner = teams.find(t => t.id === rid)?.name || '—'
        } else {
          // Fall back to group standings
          const groupMatches = allMatches.filter(m => m.phase === 'group' && m.status === 'done')
          if (groupMatches.length > 0) {
            const standings = calcStandings(teams, groupMatches)
            champ = standings[0]?.name || '—'
            runner = standings[1]?.name || '—'
            third = standings[2]?.name || '—'
          }
        }
        return [`${i + 1}`, nomor.name, `🥇 ${champ}`, `🥈 ${runner}`, `🥉 ${third}`]
      })

      autoTable(doc, {
        startY: y,
        head: [['#', 'Nomor Pertandingan', 'Juara I', 'Juara II', 'Juara III']],
        body: champRows,
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [26, 71, 42], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        alternateRowStyles: { fillColor: [252, 248, 240] },
        margin: { left: ML, right: MR },
        columnStyles: { 0: { cellWidth: 10 }, 2: { fontStyle: 'bold' } },
      })
      y = doc.lastAutoTable.finalY + 16

      // ─────────────────────────────────────────────────
      // PER NOMOR PERTANDINGAN
      // ─────────────────────────────────────────────────
      for (let ni = 0; ni < nomors.length; ni++) {
        const nomor = nomors[ni]
        const nd = nomorData[nomor.id] || {}
        const nTeams = nd.teams || []
        const nMatches = nd.matches || []

        // ── JUDUL NOMOR ──
        doc.addPage(); y = 20
        doc.setFillColor(13, 27, 18)
        doc.rect(0, 0, W, H, 'F')
        doc.setFillColor(45, 106, 79)
        doc.rect(0, 0, W, 6, 'F')
        doc.setFillColor(244, 160, 28)
        doc.rect(0, 5, W, 2, 'F')

        doc.setTextColor(82, 183, 136)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'normal')
        doc.text(`NOMOR ${String(ni + 1).padStart(2, '0')}`, W / 2, 80, { align: 'center' })

        doc.setTextColor(244, 160, 28)
        doc.setFontSize(36)
        doc.setFont('helvetica', 'bold')
        const splitNama = doc.splitTextToSize(nomor.name.toUpperCase(), CW)
        doc.text(splitNama, W / 2, 100, { align: 'center' })

        doc.setTextColor(200, 220, 200)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`${nTeams.length} Kontingen Peserta`, W / 2, 120, { align: 'center' })
        doc.text(`Format: ${nomor.format === 'grup-knockout' ? 'Grup + Knockout' : nomor.format === 'knockout' ? 'Sistem Gugur' : 'Round Robin'}`, W / 2, 130, { align: 'center' })

        // ── DAFTAR KONTINGEN ──
        doc.addPage(); y = 20
        doc.setFillColor(255, 255, 255)
        doc.rect(0, 0, W, H, 'F')

        sectionHeader(`DAFTAR KONTINGEN PESERTA — ${nomor.name.toUpperCase()}`)

        autoTable(doc, {
          startY: y,
          head: [['No', 'Nama Tim / Kontingen', 'Asal Daerah', 'Pelatih']],
          body: nTeams.map((t, i) => [i + 1, t.name, t.origin || '—', t.coach || '—']),
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [26, 71, 42], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 247] },
          margin: { left: ML, right: MR },
          columnStyles: { 0: { cellWidth: 10 } },
        })
        y = doc.lastAutoTable.finalY + 12

        // ── DAFTAR ATLET, MANAGER & OFFICIAL ──
        checkPage(30)
        sectionHeader(`DAFTAR ATLET, MANAGER & OFFICIAL — ${nomor.name.toUpperCase()}`)

        autoTable(doc, {
          startY: y,
          head: [['No', 'Kontingen', 'Kapten/Atlet Utama', 'Atlet', 'Manager & Official']],
          body: nTeams.map((t, i) => [
            i + 1, t.name,
            t.captain || '—',
            t.athletes || '—',
            t.officials || '—',
          ]),
          styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
          headStyles: { fillColor: [45, 106, 79], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 247] },
          margin: { left: ML, right: MR },
          columnStyles: { 0: { cellWidth: 10 }, 3: { cellWidth: 45 }, 4: { cellWidth: 40 } },
        })
        y = doc.lastAutoTable.finalY + 12

        // ── PEMBAGIAN POOL ──
        checkPage(30)
        const groupMatches = nMatches.filter(m => m.phase === 'group')
        const uniqueGrps = [...new Set(groupMatches.map(m => m.groupId))].map(gid => {
          const m = groupMatches.find(x => x.groupId === gid)
          const tids = [...new Set(groupMatches.filter(x => x.groupId === gid).flatMap(x => [x.homeId, x.awayId]))]
          return { id: gid, name: m?.groupName || gid, teamIds: tids }
        })

        sectionHeader(`PEMBAGIAN POOL — ${nomor.name.toUpperCase()}`)

        if (uniqueGrps.length === 0) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(120, 120, 120)
          doc.text('Pool belum diatur.', ML, y); y += 12
        } else {
          uniqueGrps.forEach(grp => {
            checkPage(20)
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(45, 106, 79)
            doc.text(grp.name, ML, y); y += 6

            const grpTeams = nTeams.filter(t => grp.teamIds.includes(t.id))
            autoTable(doc, {
              startY: y,
              head: [['No', 'Nama Tim']],
              body: grpTeams.map((t, i) => [i + 1, t.name]),
              styles: { fontSize: 10, cellPadding: 3 },
              headStyles: { fillColor: [64, 145, 108], textColor: 255 },
              margin: { left: ML, right: MR },
              columnStyles: { 0: { cellWidth: 12 } },
              tableWidth: 80,
            })
            y = doc.lastAutoTable.finalY + 8
          })
        }

        // ── OFFICIAL RESULT ──
        checkPage(30)
        sectionHeader(`OFFICIAL RESULT — ${nomor.name.toUpperCase()}`)

        // Group standings
        if (uniqueGrps.length > 0) {
          uniqueGrps.forEach(grp => {
            const grpTeams = nTeams.filter(t => grp.teamIds.includes(t.id))
            const grpMatches = groupMatches.filter(m => m.groupId === grp.id)
            const standings = calcStandings(grpTeams, grpMatches)

            checkPage(30)
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 71, 42)
            doc.text(`Klasemen ${grp.name}`, ML, y); y += 5

            autoTable(doc, {
              startY: y,
              head: [['#', 'Tim', 'P', 'M', 'K', 'Set+', 'Set-', 'Poin']],
              body: standings.map((r, i) => [i + 1, r.name, r.P, r.W, r.L, r.SetW, r.SetL, r.Pts]),
              styles: { fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [26, 71, 42], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [245, 250, 247] },
              margin: { left: ML, right: MR },
              columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12 }, 4: { cellWidth: 12 }, 5: { cellWidth: 14 }, 6: { cellWidth: 14 }, 7: { cellWidth: 14, fontStyle: 'bold' } },
            })
            y = doc.lastAutoTable.finalY + 6

            // Match results for this group
            const doneGrpM = grpMatches.filter(m => m.status === 'done')
            if (doneGrpM.length > 0) {
              autoTable(doc, {
                startY: y,
                head: [['Tim A', 'S1', 'S2', 'S3', 'Set', 'Tim B', 'Tanggal']],
                body: doneGrpM.map(m => {
                  const sets = m.sets || []
                  const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(sets)
                  const ht = nTeams.find(t => t.id === m.homeId)?.name || '—'
                  const at = nTeams.find(t => t.id === m.awayId)?.name || '—'
                  const s1 = sets[0] ? `${sets[0].home||0}-${sets[0].away||0}` : '—'
                  const s2 = sets[1] ? `${sets[1].home||0}-${sets[1].away||0}` : '—'
                  const s3 = sets[2] ? `${sets[2].home||0}-${sets[2].away||0}` : '—'
                  return [ht, s1, s2, s3, `${hw}-${aw}`, at, m.date ? fmtDate(m.date) : '—']
                }),
                styles: { fontSize: 8, cellPadding: 2.5 },
                headStyles: { fillColor: [82, 183, 136], textColor: 255 },
                alternateRowStyles: { fillColor: [248, 253, 250] },
                margin: { left: ML, right: MR },
                columnStyles: { 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 18, halign: 'center' }, 4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' } },
              })
              y = doc.lastAutoTable.finalY + 10
            }
          })
        }

        // Knockout results
        const koMatches = nMatches.filter(m => m.phase === 'knockout' && m.status === 'done')
        if (koMatches.length > 0) {
          checkPage(30)
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 71, 42)
          doc.text('Fase Knockout', ML, y); y += 5

          const rounds = [...new Set(koMatches.map(m => m.round))].sort((a, b) => b - a)
          for (const r of rounds) {
            const rMatches = koMatches.filter(m => m.round === r)
            const rName = rMatches[0]?.roundName || `Babak ${r}`
            checkPage(20)
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(45, 106, 79)
            doc.text(rName, ML, y); y += 5

            autoTable(doc, {
              startY: y,
              head: [['Tim A', 'S1', 'S2', 'S3', 'Set', 'Tim B', 'Pemenang', 'Tanggal']],
              body: rMatches.map(m => {
                const sets = m.sets || []
                const { homeSetWins: hw, awaySetWins: aw } = calcSetResult(sets)
                const ht = nTeams.find(t => t.id === m.homeId)?.name || '—'
                const at = nTeams.find(t => t.id === m.awayId)?.name || '—'
                const winner = nTeams.find(t => t.id === m.winnerId)?.name || '—'
                const s1 = sets[0] ? `${sets[0].home||0}-${sets[0].away||0}` : '—'
                const s2 = sets[1] ? `${sets[1].home||0}-${sets[1].away||0}` : '—'
                const s3 = sets[2] ? `${sets[2].home||0}-${sets[2].away||0}` : '—'
                return [ht, s1, s2, s3, `${hw}-${aw}`, at, winner, m.date ? fmtDate(m.date) : '—']
              }),
              styles: { fontSize: 8, cellPadding: 2.5 },
              headStyles: { fillColor: [26, 71, 42], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [245, 250, 247] },
              margin: { left: ML, right: MR },
              columnStyles: { 1: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 6: { fontStyle: 'bold', textColor: [26, 71, 42] } },
            })
            y = doc.lastAutoTable.finalY + 10
          }
        }
      }

      // ─────────────────────────────────────────────────
      // HALAMAN PENUTUP
      // ─────────────────────────────────────────────────
      doc.addPage()
      doc.setFillColor(13, 27, 18)
      doc.rect(0, 0, W, H, 'F')
      doc.setFillColor(45, 106, 79)
      doc.rect(0, 0, W, 6, 'F')
      doc.setFillColor(244, 160, 28)
      doc.rect(0, 5, W, 2, 'F')

      doc.setFillColor(26, 71, 42)
      doc.roundedRect(ML, 60, CW, 140, 6, 6, 'F')

      doc.setTextColor(244, 160, 28)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('KATA PENUTUP', W / 2, 80, { align: 'center' })

      doc.setFillColor(244, 160, 28)
      doc.rect(ML + 20, 85, CW - 40, 1, 'F')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(200, 220, 200)
      const penutupText = event.penutupan ||
        `Demikianlah laporan akhir pertandingan ${event.name} ini kami susun sebagai bentuk pertanggungjawaban dan dokumentasi resmi penyelenggaraan kejuaraan.\n\nKami berharap pelaksanaan kejuaraan ini dapat memberikan manfaat yang besar bagi perkembangan olahraga sepak takraw, khususnya dalam pembinaan prestasi atlet.\n\nAtas perhatian dan dukungan semua pihak, kami mengucapkan terima kasih yang sebesar-besarnya. Semoga olahraga sepak takraw Indonesia terus berkembang dan berprestasi di tingkat nasional maupun internasional.\n\nHidup Sepak Takraw Indonesia!`
      const splitPenutup = doc.splitTextToSize(penutupText, CW - 20)
      doc.text(splitPenutup, W / 2, 96, { align: 'center' })

      doc.setTextColor(82, 183, 136)
      doc.setFontSize(9)
      doc.text(`Dicetak: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, W / 2, 192, { align: 'center' })

      // Bottom brand
      doc.setFillColor(45, 106, 79)
      doc.rect(0, H - 28, W, 28, 'F')
      doc.setTextColor(244, 160, 28)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TURNAMEN MANAGER SEPAK TAKRAW', W / 2, H - 16, { align: 'center' })
      doc.setTextColor(180, 210, 190)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('by Syaifuddin Ali', W / 2, H - 8, { align: 'center' })

      // ── Page numbers ──
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.setFont('helvetica', 'normal')
        doc.text(`${event.name}`, ML, H - 6)
        doc.text(`Halaman ${i - 1} dari ${pageCount - 1}`, W - MR, H - 6, { align: 'right' })
        doc.setDrawColor(200, 220, 200)
        doc.line(ML, H - 10, W - MR, H - 10)
      }

      const filename = `Laporan_${event.name.replace(/\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`
      doc.save(filename)
      showToast(`✅ PDF berhasil didownload!`)
    } catch (err) {
      console.error(err)
      showToast('❌ Gagal membuat PDF. Coba lagi.')
    }
    setGenerating(false)
  }

  // If no eventId selected, show event picker
  if (!eventId || !event) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <div className="tag-line" style={{ marginBottom: 8 }}>Generate</div>
          <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>LAPORAN PDF</h1>
          <p style={{ color: 'var(--gray-600)', fontSize: 14, marginTop: 4 }}>Pilih event untuk membuat laporan PDF.</p>
        </div>
        {events.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <p>Belum ada event. Buat event terlebih dahulu.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('events')}>→ Ke Daftar Event</button>
          </div>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: 20, color: 'var(--white)', marginBottom: 16 }}>PILIH EVENT</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => (
                <div key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(64,145,108,0.2)', borderRadius: 10,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(64,145,108,0.2)'}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      {ev.location && `📍 ${ev.location}`}
                      {ev.date && ` · 📅 ${new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`badge ${ev.status === 'selesai' ? 'badge-gold' : ev.status === 'berlangsung' ? 'badge-green' : 'badge-gray'}`}>
                      {ev.status === 'selesai' ? 'Selesai' : ev.status === 'berlangsung' ? 'Berlangsung' : 'Persiapan'}
                    </span>
                    <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>
                      📄 Buat Laporan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Lazy-load data for each nomor */}
      {nomors.map(n => <NomorDataLoader key={n.id} eventId={eventId} nomor={n} onData={handleNomorData} />)}

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="tag-line" style={{ marginBottom: 8 }}>Generate</div>
            <h1 style={{ fontSize: 48, color: 'var(--gold)' }}>LAPORAN PDF</h1>
            <p style={{ color: 'var(--gray-600)', fontSize: 14, marginTop: 4 }}>Event: <strong style={{ color: 'var(--white)' }}>{event.name}</strong></p>
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setSelectedEventId(null); setNomorData({}) }}>
            ← Ganti Event
          </button>
        </div>
      </div>

      {/* Preview struktur PDF */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, color: 'var(--white)', marginBottom: 16 }}>STRUKTUR LAPORAN PDF</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { no: '1', label: 'Cover & Nama Turnamen', icon: '🏆' },
            { no: '2', label: 'Kata Pembukaan', icon: '📝' },
            { no: '3', label: 'Jadwal Pertandingan (semua nomor)', icon: '📅' },
            { no: '4', label: 'Daftar Isi', icon: '📋' },
            { no: '5', label: 'Daftar Pemenang Kejuaraan', icon: '🥇' },
            ...nomors.flatMap((n, i) => [
              { no: `6.${i + 1}`, label: `Judul: ${n.name}`, icon: '🏸', indent: true },
              { no: '', label: 'Daftar Kontingen Peserta', icon: '─', indent: true },
              { no: '', label: 'Daftar Atlet, Manager & Official', icon: '─', indent: true },
              { no: '', label: 'Pembagian Pool', icon: '─', indent: true },
              { no: '', label: 'Official Result (klasemen + skor per set)', icon: '─', indent: true },
            ]),
            { no: '7', label: 'Kata Penutup', icon: '🙏' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: `${item.indent ? '6px 16px 6px 32px' : '8px 16px'}`,
              background: item.indent ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
              borderRadius: 6, borderLeft: `3px solid ${item.indent ? 'rgba(82,183,136,0.3)' : 'rgba(244,160,28,0.4)'}`,
            }}>
              <span style={{ fontSize: item.indent ? 12 : 14 }}>{item.icon}</span>
              {item.no && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', minWidth: 28 }}>{item.no}</span>}
              <span style={{ fontSize: item.indent ? 12 : 13, color: item.indent ? 'var(--gray-300)' : 'var(--white)', fontWeight: item.indent ? 400 : 500 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Nomor Pertandingan', value: nomors.length, icon: '🏸' },
          { label: 'Total Kontingen', value: Object.values(nomorData).reduce((s, d) => s + (d.teams?.length || 0), 0), icon: '🏅' },
          { label: 'Total Match', value: Object.values(nomorData).reduce((s, d) => s + (d.matches?.length || 0), 0), icon: '⚽' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px' }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--green-accent)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 16, letterSpacing: 1 }}
        onClick={generatePDF}
        disabled={generating}
      >
        {generating
          ? <><span className="spinner" style={{ marginRight: 8 }} /> Membuat PDF...</>
          : '📄 Download Laporan PDF Lengkap'}
      </button>
    </div>
  )
}
