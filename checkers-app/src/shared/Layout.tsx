import { ReactNode} from 'react';
import Header from "./Header";
import NavbarDefault from "./BotNavBar";
import { useUser } from '../UserContext';

interface LayoutProps {
    pageHeader: string,
    children: ReactNode,
}

export default function Layout({pageHeader, children }: LayoutProps) {
    const {unassessed, unchecked} = useUser();
    
    return (
        <div>
            <div className='layout-padding'>
                <Header name={pageHeader}/>
                {/* <PageHeader>{pageHeader}</PageHeader> */}
            </div>
            <div className="pb-16">
                {children}
            </div>
            <NavbarDefault unread={unassessed + unchecked} />
        </div>
    )
}