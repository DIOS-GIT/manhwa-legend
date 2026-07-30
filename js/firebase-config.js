// firebase-config.js
// Configuración central de Firebase. Reemplazá los valores con los de tu proyecto
// (mismo patrón que agencia-de-turismo / Punto Frío Bocagrande).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9NfaGr-_-EylGxVd5c5_iYd6ITUnRLu0",
  authDomain: "juego-manhwa-18.firebaseapp.com",
  projectId: "juego-manhwa-18",
  storageBucket: "juego-manhwa-18.firebasestorage.app",
  messagingSenderId: "1024334256442",
  appId: "1:1024334256442:web:508ed2ef808d141bd59803",
  measurementId: "G-PPWFR8KVGS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
