import React, { createContext, useContext, useState } from "react";

interface UserContextProps {
  checkerId: string | null;
  name: string;
  setCheckerId: (checkerId: string | null) => void;
  setName: (name: string) => void;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [checkerId, setCheckerId] = useState<string | null>(
    import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_ID : null
  );
  const [name, setName] = useState<string>(
    import.meta.env.MODE === "dev" ? import.meta.env.VITE_CHECKER_NAME : null
  );

  const value = { checkerId, setCheckerId, name, setName };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextProps => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
