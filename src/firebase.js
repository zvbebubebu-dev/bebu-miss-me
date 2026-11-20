
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCy4EmndJudYTafJvcC3bttUuX7zUf34kk",
  authDomain: "bebumissme.firebaseapp.com",
  projectId: "bebumissme",
  storageBucket: "bebumissme.firebasestorage.app",
  messagingSenderId: "104572813249",
  appId: "1:104572813249:web:0c199d8e9b1163f905b940"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
