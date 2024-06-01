import { Typography } from "@material-tailwind/react";
import MenuComponent from "./Menu";
import { useUser } from "../../providers/UserContext";

interface HeaderProps {
  pageName: string;
  showMenu?: boolean;
}

export default function Header({ pageName, showMenu = false }: HeaderProps) {
  const { checkerDetails } = useUser();
  return (
    <div className="flex justify-between items-center fixed top-0 left-0 right-0 z-30 px-[5vw] pt-[3vh] bg-white dark:bg-dark-background-color">
      <Typography variant="h3" className="text-primary-color2">
        {pageName}
      </Typography>
      <div className="flex items-center gap-4">
        {showMenu && <MenuComponent isActive={checkerDetails.isActive} />}
        <img
          className="rounded-full h-[12vw] w-[12vw] orange-glow"
          src="/logo-1.jpg"
        />
      </div>
    </div>
  );
}
