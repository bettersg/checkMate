import { Typography } from "@material-tailwind/react";

interface HeaderProps {
  children: string;
}

export default function Header({ children }: HeaderProps) {
  return (
    <div className="container relative mb-4">
      <div className="w-[78vw]">
      <Typography variant="h2" className="text-primary-color2">Hello, {children}</Typography>
      </div>
      <img className="rounded-full absolute top-0 right-0 h-[12vw] w-[12vw] orange-glow" src="./logo-1.jpg" />
    </div>
  );
}