import { Typography } from "@material-tailwind/react";
import MenuComponent from "./Menu";
import { useUser } from "../../providers/UserContext";
import { BackButton } from "./BackButton";

interface HeaderProps {
  pageName: string;
  showMenu?: boolean;
}

export default function Header({ pageName, showMenu = false }: HeaderProps) {
  const { checkerDetails } = useUser();
  return (
    <div className="relative flex items-center fixed top-0 left-0 right-0 z-30 bg-white dark:bg-dark-background-color">
      <div className="flex justify-start items-center flex-grow-0">
        <BackButton />
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2">
        <Typography variant="h3" className="text-primary-color2">
          {pageName}
        </Typography>
      </div>

      <div className="flex justify-end items-center flex-grow gap-4">
        {showMenu && <MenuComponent isActive={checkerDetails.isActive} />}
        <img
          className="rounded-full h-[12vw] w-[12vw] orange-glow"
          src="/logo-1.jpg"
        />
      </div>
    </div>
  );
}
