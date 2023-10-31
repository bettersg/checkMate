import { ReactNode } from 'react';
import Header from "./Header";
import NavbarDefault from "./BotNavBar";
import PageHeader from "./PageHeader";

interface LayoutProps {
    name: string,
    pageHeader: string,
    children: ReactNode;
}

export default function Layout({ name, pageHeader, children }: LayoutProps) {
    return (
        <div>
            <Header>{name}</Header>
            <PageHeader>{pageHeader}</PageHeader>
            <div className="pb-16">
                {children}
            </div>
            <NavbarDefault />
        </div>
    )
}