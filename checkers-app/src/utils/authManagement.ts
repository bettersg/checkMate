// utils/authHelpers.js
import { getAuth, signInWithCustomToken } from "firebase/auth";
import app from "../firebase";

export const signInWithToken = async (
  customToken: string,
  setCheckerDetails: (checker: any) => void,
  checkerId: string,
  checkerName: string
) => {
  const auth = getAuth(app);
  try {
    // Wait for the signInWithCustomToken to resolve
    await signInWithCustomToken(auth, customToken);
    // If successful, set the checker ID and name
    setCheckerDetails((checker: any) => ({
      ...checker,
      checkerId,
      checkerName,
    }));
  } catch (error) {
    alert(`Error signing in with custom token ${error}`);
    console.error("Error during Firebase signInWithCustomToken", error);
    // Rethrow or handle the error as needed
    throw new Error("Error during Firebase signInWithCustomToken");
  }
};

export const signOut = async () => {
  const auth = getAuth(app);
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error signing out", error);
    throw new Error("Error signing out");
  }
};
