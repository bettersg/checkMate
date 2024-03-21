// utils/authHelpers.js
import { getAuth, signInWithCustomToken } from "firebase/auth";
import app from "../firebase";

export const signInWithToken = async (
  customToken: string,
  setCheckerId: (checkerId: string) => void,
  setCheckerName: (checkerName: string) => void,
  checkerId: string,
  checkerName: string
) => {
  const auth = getAuth(app);
  try {
    // Wait for the signInWithCustomToken to resolve
    await signInWithCustomToken(auth, customToken);
    // If successful, set the checker ID and name
    setCheckerId(checkerId);
    setCheckerName(checkerName);
  } catch (error) {
    console.error("Error during Firebase signInWithCustomToken", error);
    // Rethrow or handle the error as needed
    throw new Error("Error during Firebase signInWithCustomToken");
  }
};
