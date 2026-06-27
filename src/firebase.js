import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCG_MEJKXb6zsPFqlROyg0C3Olu-3uK1iA",
  authDomain: "sepaktakraw-app.firebaseapp.com",
  projectId: "sepaktakraw-app",
  storageBucket: "sepaktakraw-app.firebasestorage.app",
  messagingSenderId: "424977690280",
  appId: "1:424977690280:web:70fc583ea67be26f981c9d"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
