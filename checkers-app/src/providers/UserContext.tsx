import { getCheckerPendingCount } from "../services/api";
import React, { createContext, useContext, useState } from "react";

interface UserContextProps {
  checkerId: string | null;
  name: string;
  pendingCount: number;
  setCheckerId: (checkerId: string | null) => void;
  setName: (name: string) => void;
  setPendingCount: (pendingCount: number) => void;
  incrementSessionVotedCount: () => void;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [checkerId, setCheckerId] = useState<string | null>(
    import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_ID : null
  );
  const [name, setName] = useState<string>(
    import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_NAME : null
  );

  const [sessionVotedCount, setSessionVotedCount] = useState<number>(0);

  const incrementSessionVotedCount = () => {
    // This function increments the sessionVotedCount by 1
    setSessionVotedCount((currentCount) => currentCount + 1);
  };

  const [pendingCount, setPendingCount] = useState<number>(0);

  const value = {
    checkerId,
    setCheckerId,
    name,
    setName,
    pendingCount,
    setPendingCount,
    incrementSessionVotedCount,
  };

  //call getCheckerPendingCount and set pendingCount when incrementSessionVotedCount changes
  React.useEffect(() => {
    if (checkerId) {
      getCheckerPendingCount(checkerId)
        .then((data) => {
          setPendingCount(data.pendingCount);
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }, [sessionVotedCount]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextProps => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
