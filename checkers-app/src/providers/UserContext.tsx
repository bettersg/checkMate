import React, { createContext, useContext } from 'react';
import { Message } from '../types';

interface UserContextProps {
    userId: string | null;
    name: string;
    phoneNo: string | null;
    messages: Message[]; // Include messages here
    updateMessages: (prevMessages: Message[]) => Message[] | void;
    unassessed: number,
    updateUnassessed: (prevUnAssessed: number) => number | void;
    unchecked: number,
    updateUnchecked: (prevUnChecked: number) => number | void;
    pending: Message[],
    assessed: Message[],
    updatePending: (prevPending: Message[]) => Message[] | void;
    updateAssessed: (prevAssessed: Message[]) => Message[] | void;
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
