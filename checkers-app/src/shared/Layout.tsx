import { ReactNode} from 'react';
import Header from "./Header";
import NavbarDefault from "./BotNavBar";
import PageHeader from "./PageHeader";
import { useUser } from '../UserContext';

interface LayoutProps {
    pageHeader: string,
    children: ReactNode,
}

export default function Layout({pageHeader, children }: LayoutProps) {
    const {name, unassessed, unchecked} = useUser();
    
    return (
        <div>
            <div className='layout-padding'>
                <Header name={name}/>
                <PageHeader>{pageHeader}</PageHeader>
            </div>
            <div className="pb-16">
                {children}
            </div>
            <NavbarDefault unread={unassessed + unchecked} />
        </div>
    )
}