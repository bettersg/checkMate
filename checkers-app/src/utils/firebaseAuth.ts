import { connectAuthEmulator, getAuth } from "firebase/auth";
import app from "../firebase"; // Import your Firebase app instance

/**
 * Connects to the Firebase Auth emulator if in development environment.
 */
export const connectAuth = () => {
  const auth = getAuth(app);
  if (import.meta.env.MODE === "dev") {
    const emulatorUrl = "http://127.0.0.1:9099"; // Your Auth emulator URL
    connectAuthEmulator(auth, emulatorUrl);
    console.log(`Connected to Firebase Auth emulator at ${emulatorUrl}`);
  }
};
