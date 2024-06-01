import { ReactNode } from "react";
import Header from "./Header";
import NavbarDefault from "./BotNavBar";

interface LayoutProps {
  pageName: string;
  children: ReactNode;
  showMenu?: boolean;
}

export default function Layout({
  pageName,
  children,
  showMenu = false,
}: LayoutProps) {
  return (
    <div className="dark:bg-dark-background-color min-h-screen overflow-x-hidden">
      <style>
        {`
            ::-webkit-scrollbar {
                display: none;
            }
        `}
      </style>
      {/* <div className='layout-padding'> */}
      <Header pageName={pageName} showMenu={showMenu} />
      {/* <PageHeader>{pageHeader}</PageHeader>
    </div> */}
      <div className="pb-16 mt-16">{children}</div>
      <NavbarDefault />
    </div>
  );
}
