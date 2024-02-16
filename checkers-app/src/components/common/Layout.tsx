import { ReactNode } from 'react';
import Header from "./Header";
import NavbarDefault from "./BotNavBar";
import { useUser } from '../../providers/UserContext';

interface LayoutProps {
    pageHeader: string,
    children: ReactNode,
}

export default function Layout({ pageHeader, children }: LayoutProps) {
    const { unassessed, unchecked } = useUser();

    return (
        <div className='dark:bg-dark-background-color min-h-screen overflow-x-hidden'>
            <style>
                {`
                    ::-webkit-scrollbar {
                        display: none;
                    }
                    `}
            </style>
            {/* <div className='layout-padding'> */}
                <Header name={pageHeader} />
                {/* <PageHeader>{pageHeader}</PageHeader>
            </div> */}
            <div className="pb-16 mt-16">
                {children}
            </div>
            <NavbarDefault unread={unassessed + unchecked} />
        </div>
    )
}