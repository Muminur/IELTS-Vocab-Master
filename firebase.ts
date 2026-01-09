import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDDEK0xQ-u1Yoa5AMQXgTXjN2eGfR3RSoU",
  authDomain: "vocubularymaster.firebaseapp.com",
  projectId: "vocubularymaster",
  storageBucket: "vocubularymaster.firebasestorage.app",
  messagingSenderId: "992999134658",
  appId: "1:992999134658:web:9eac116c452f483409f25b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();