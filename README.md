# 🏆 Turnamen Manager Sepak Takraw
### by Syaifuddin Ali

Aplikasi manajemen turnamen sepak takraw berbasis web dengan:
- ✅ Login Gmail & akun email (data tersimpan per akun)
- ✅ Kode kunci pendaftaran
- ✅ Multi-event & multi-nomor pertandingan
- ✅ Input skor per set (maks 15, deuce 16-17)
- ✅ Nomor: Regu Putra/Putri, Double Putra/Putri, Quadrant Putra/Putri
- ✅ Laporan PDF lengkap (18 bagian sesuai format resmi)

---  

## 🔧 LANGKAH 1: Setup Firebase (WAJIB)

### 1.1 Buat Project Firebase
1. Buka [console.firebase.google.com](https://console.firebase.google.com)
2. Klik **"Create a project"**
3. Nama project: `sepak-takraw-manager` (atau bebas)
4. Disable Google Analytics → klik **Create project**

### 1.2 Aktifkan Authentication
1. Di sidebar kiri, klik **Build → Authentication**
2. Klik **Get started**
3. Tab **Sign-in method** → aktifkan **Google** (toggle ON) → Save
4. Aktifkan juga **Email/Password** → Save

### 1.3 Aktifkan Firestore Database
1. Di sidebar kiri, klik **Build → Firestore Database**
2. Klik **Create database**
3. Pilih **Start in test mode** → pilih region terdekat (asia-southeast1) → **Enable**

### 1.4 Atur Firestore Rules
Di Firestore → tab **Rules**, ganti semua konten dengan ini:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Klik **Publish**.

### 1.5 Dapatkan Firebase Config
1. Klik ikon ⚙️ (Project Settings) di sidebar kiri atas
2. Scroll ke bawah ke **"Your apps"**
3. Klik ikon **`</>`** (Web)
4. Nama app: `sepak-takraw-web` → klik **Register app**
5. Copy kode `firebaseConfig` yang muncul

### 1.6 Paste Config ke Aplikasi
Buka file `src/firebase.js`, ganti nilai placeholder dengan config milikmu:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",          // ← ganti ini
  authDomain: "project.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
}
```

---

## 🚀 LANGKAH 2: Deploy ke Vercel via GitHub

### 2.1 Upload ke GitHub
```bash
git init
git add .
git commit -m "Initial commit - Turnamen Manager Sepak Takraw"
git remote add origin https://github.com/USERNAME/sepak-takraw-manager.git
git push -u origin main
```

### 2.2 Deploy ke Vercel
1. Buka [vercel.com](https://vercel.com) → login dengan GitHub
2. Klik **"Add New Project"**
3. Import repo `sepak-takraw-manager`
4. Vercel otomatis detect Vite → klik **Deploy**
5. Website live dalam ~1 menit! 🎉

### 2.3 Tambahkan Domain ke Firebase
Setelah website live di Vercel, tambahkan URL-nya ke Firebase:
1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Klik **Add domain** → masukkan URL Vercel kamu (contoh: `sepak-takraw.vercel.app`)

---

## 💻 Development Lokal
```bash
npm install
npm run dev
# Buka http://localhost:5173
```

---

## 📋 Nomor Pertandingan yang Tersedia
- Regu Putra & Regu Putri
- Double Putra & Double Putri  
- Quadrant Putra & Quadrant Putri
- Custom (bisa tambah nomor lain)

## ⚽ Aturan Skor Per Set
- Maksimal poin: **15**
- Deuce: **16-15, 17-16** (sampai selisih 1 poin max 17)
- Pemenang set: tim yang lebih dulu capai 15, atau 17 saat deuce
- Pemenang match: yang menang **2 set** dari 3

---

## 🔐 Kode Kunci Pendaftaran
Kode kunci yang harus dimasukkan saat daftar akun baru:
```
Sepaktakraw Indonesia
```
(Persis seperti ini, huruf kapital S dan I)

---

## 📄 Format Laporan PDF
1. Cover & nama turnamen
2. Kata Pembukaan
3. Jadwal Pertandingan
4. Daftar Isi
5. Daftar Pemenang Kejuaraan
6. Per Nomor Pertandingan:
   - Judul nomor
   - Daftar kontingen peserta
   - Daftar atlet, manager & official
   - Pembagian pool
   - Official result (skor per set)
7. Kata Penutup

---

© 2025 Syaifuddin Ali · Turnamen Manager Sepak Takraw
