import { ReactNode } from "react";
import Header from "./Header";
import NavbarDefault from "./BotNavBar";

interface LayoutProps {
  pageName: string;
  children: ReactNode;
}

export default function Layout({ pageName, children }: LayoutProps) {
  return (
    <div>
      <div className="layout-padding">
        <Header pageName={pageName} />
        {/* <PageHeader>{pageHeader}</PageHeader> */}
      </div>
      <div className="pb-16">{children}</div>
      <NavbarDefault />
    </div>
  );
}
