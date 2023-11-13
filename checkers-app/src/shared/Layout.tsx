import { ReactNode} from 'react';
import Header from "./Header";
import NavbarDefault from "./BotNavBar";
import PageHeader from "./PageHeader";
import { useUser } from '../UserContext';

interface LayoutProps {
    name: string,
    pageHeader: string,
    children: ReactNode,
    user_unassessed: number
}

export default function Layout({pageHeader, children, user_unassessed }: LayoutProps) {
    const {name} = useUser();
    
    return (
        <div>
            <Header name={name}/>
            <PageHeader>{pageHeader}</PageHeader>
            <div className="pb-16">
                {children}
            </div>
            <NavbarDefault unassessed={user_unassessed} />
        </div>
    )
}