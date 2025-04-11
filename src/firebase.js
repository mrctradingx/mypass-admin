import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Cấu hình Firebase (dán đoạn mã từ Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyCoSJaSYZDdAyZpM-3mCXsU_ZQUXYRHIJA",
  authDomain: "mypass-29358.firebaseapp.com",
  projectId: "mypass-29358",
  storageBucket: "mypass-29358.firebasestorage.app",
  messagingSenderId: "750286477020",
  appId: "1:750286477020:web:a30de357e17dce4e344619"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo Firestore
const db = getFirestore(app);

export { db };
