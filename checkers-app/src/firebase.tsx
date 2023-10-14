import { initializeApp, getApps, FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyD47VhPM3PGoFFxYs5YwwZ8Wch4fjgqPm0",
  authDomain: "checkmate-373101.firebaseapp.com",
  projectId: "checkmate-373101",
  storageBucket: "checkmate-373101.appspot.com",
  messagingSenderId: "740001415157",
  appId: "1:740001415157:web:3e13228477e77a6abcaabc",
  measurementId: "G-0XFK2MFQ8S",
};

// Initialize Firebase
// Check if no apps have been initialized, then initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]; // if already initialized, use that one
}

export default app;
