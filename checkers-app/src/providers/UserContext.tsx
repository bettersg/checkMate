import { getCheckerPendingCount } from "../services/api";
import { CheckerDetails } from "../types";
import React, { createContext, useContext, useState } from "react";

type AuthScopes = {
  customToken?: string;
  checkerId?: string;
  name?: string;
  isNewUser?: boolean;
  isOnboardingComplete?: boolean;
  isActive?: boolean;
};

interface UserContextProps {
  checkerDetails: CheckerDetails;
  authScopes: {
    customToken?: string;
    checkerId?: string;
    name?: string;
    isNewUser?: boolean;
    isOnboardingComplete?: boolean;
    isActive?: boolean;
  };
  setCheckerDetails: (
    checker:
      | CheckerDetails
      | ((currentChecker: CheckerDetails) => CheckerDetails)
  ) => void;
  incrementSessionVotedCount: () => void;
  setAuthScopes: (authScopes: AuthScopes) => void;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [checker, setChecker] = useState<CheckerDetails>({
    checkerId: null,
    checkerName:
      import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_NAME : null,
    pendingCount: 0,
    isAdmin: import.meta.env.MODE === "dev",
    tier: import.meta.env.MODE === "dev" ? "expert" : "beginner",
    isActive: true,
    certificateUrl: null, // Initialize certificateUrl
    isTester: false,
  });

  // const [checkerName, setCheckerName] = useState<string>(
  //   import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_NAME : null
  // );
  const [authScopes, setAuthScopes] = useState<AuthScopes>({});
  const [sessionVotedCount, setSessionVotedCount] = useState<number>(0);

  const incrementSessionVotedCount = () => {
    // This function increments the sessionVotedCount by 1
    setSessionVotedCount((currentCount) => currentCount + 1);
  };

  const value = {
    checkerDetails: checker,
    setCheckerDetails: setChecker,
    incrementSessionVotedCount,
    authScopes,
    setAuthScopes,
  };

  //call getCheckerPendingCount and set pendingCount when incrementSessionVotedCount changes
  React.useEffect(() => {
    if (checker?.checkerId) {
      getCheckerPendingCount(checker?.checkerId)
        .then((data) => {
          setChecker((currentChecker) => ({
            ...currentChecker,
            pendingCount: data.pendingCount,
          }));
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }, [sessionVotedCount, checker.checkerId]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextProps => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
