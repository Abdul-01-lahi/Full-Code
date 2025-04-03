// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from 'firebase/database'; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDfDcMpEVl4eeDUXv3JbBtBgEu5byna8Uo",
  authDomain: "rain-genie.firebaseapp.com",
  databaseURL: "https://rain-genie-default-rtdb.firebaseio.com",
  projectId: "rain-genie",
  storageBucket: "rain-genie.firebasestorage.app",
  messagingSenderId: "1015689406753",
  appId: "1:1015689406753:web:de28aecd5321f95d58f660",
  measurementId: "G-8M2MESZHNF" // Optional: Only needed if using Firebase Analytics
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export the database reference for use in your app
export { database, ref, onValue, set };