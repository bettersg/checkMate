import React, { createContext, useContext } from 'react';
import { Message } from './types';

interface UserContextProps {
    userId: string | null;
    name: string,
    messages: Message[]; // Include messages here
    updateMessages: (messages: Message[]) => void; 
}

const UserContext = createContext<UserContextProps | undefined>(undefined);

export const UserProvider = ({ children, value }: { children: React.ReactNode, value: UserContextProps }) => {
    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = (): UserContextProps => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
