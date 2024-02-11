import { Typography } from "@material-tailwind/react";

interface HeaderProps {
  name: string;
}

export default function Header({name}: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <Typography variant="h3" className="text-primary-color2">{name}</Typography>
      <img className="rounded-full h-[12vw] w-[12vw] orange-glow" src="./logo-1.jpg" />
    </div>
  );
}