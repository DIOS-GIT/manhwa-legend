// Configuración real de Firebase para el proyecto "manhwa-legend"
// Reemplazá el contenido de tu archivo js/firebase-config.js por este.

const firebaseConfig = {
  apiKey: "AIzaSyAMFa0z-_EyIGxVd5cJYd4ITUnRLu0",
  authDomain: "juego-manhwa-18.firebaseapp.com",
  projectId: "juego-manhwa-18",
  storageBucket: "juego-manhwa-18.firebasestorage.app",
  messagingSenderId: "1024334256442",
  appId: "1:1024334256442:web:508ed2ef808d141bd59803",
  measurementId: "G-PPWFR8KVG5"
};

// Si tu archivo original usa imports tipo módulo (Firebase v9+ modular),
// dejalo así y asegurate de que main.js / admin.js importen y usen
// este mismo objeto para inicializar la app:
//
//   import { initializeApp } from "firebase/app";
//   const app = initializeApp(firebaseConfig);
//
// Si tu proyecto usa la versión "compat" (scripts <script> directos),
// el patrón sería:
//
//   firebase.initializeApp(firebaseConfig);

export { firebaseConfig };
