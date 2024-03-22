import { initializeApp, getApps, FirebaseApp } from "firebase/app";

const firebaseConfigProd = {
  apiKey: "AIzaSyD47VhPM3PGoFFxYs5YwwZ8Wch4fjgqPm0",
  authDomain: "checkmate-373101.firebaseapp.com",
  projectId: "checkmate-373101",
  storageBucket: "checkmate-373101.appspot.com",
  messagingSenderId: "740001415157",
  appId: "1:740001415157:web:3e13228477e77a6abcaabc",
  measurementId: "G-0XFK2MFQ8S",
};

const firebaseConfigUAT = {
  apiKey: "AIzaSyDMd-PMzf49mWTPPChbHig_KFFOpT2VTsQ",
  authDomain: "checkmate-uat.firebaseapp.com",
  projectId: "checkmate-uat",
  storageBucket: "checkmate-uat.appspot.com",
  messagingSenderId: "38547202487",
  appId: "1:38547202487:web:4287716b96ad581663c832",
  measurementId: "G-28BSEYEGHP",
};

// Initialize Firebase
// Check if no apps have been initialized, then initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(
    import.meta.env.MODE === "uat" ? firebaseConfigUAT : firebaseConfigProd
  );
} else {
  app = getApps()[0]; // if already initialized, use that one
}

export default app;
