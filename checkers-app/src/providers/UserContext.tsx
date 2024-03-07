import React, { createContext, useContext } from 'react';

interface UserContextProps {
    userId: string | null;
    name: string;
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children, value }: { children: React.ReactNode, value: UserContextProps }) => {
    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = (): UserContextProps => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
