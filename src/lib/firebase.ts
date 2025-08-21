
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "adedanha-online",
  appId: "1:511908935372:web:da52f7f098ea5d1780f469",
  storageBucket: "adedanha-online.firebasestorage.app",
  apiKey: "AIzaSyChdYsXCBccoVUzsTHcDhzqx1nPdT7_Zd4",
  authDomain: "adedanha-online.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "511908935372",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
