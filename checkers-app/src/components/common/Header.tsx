import { Typography } from "@material-tailwind/react";

interface HeaderProps {
  pageName: string;
}

export default function Header({ pageName }: HeaderProps) {
  return (
    <div className="flex justify-between items-center fixed top-0 left-0 right-0 z-30 px-[5vw] pt-[3vh] bg-white dark:bg-dark-background-color">
      <Typography variant="h3" className="text-primary-color2">
        {pageName}
      </Typography>
      <img
        className="rounded-full h-[12vw] w-[12vw] orange-glow"
        src="/logo-1.jpg"
      />
    </div>
  );
}
