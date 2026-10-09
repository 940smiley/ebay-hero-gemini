// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCH-JBKgLSnwC2ftD5DHPQCmprYKNJU_Ls",
  authDomain: "gen-lang-client-0016498826.firebaseapp.com",
  projectId: "gen-lang-client-0016498826",
  storageBucket: "gen-lang-client-0016498826.firebasestorage.app",
  messagingSenderId: "780336778247",
  appId: "1:780336778247:web:1ba90c0519567ec10deea2"
};

// Initialize Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
