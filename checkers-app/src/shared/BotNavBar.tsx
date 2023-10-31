import { Navbar, Typography, Badge } from "@material-tailwind/react";

import {
  PresentationChartBarIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

//number of unassessed msgs from user
interface NavBarProps {
  unassessed: number
}

export default function NavbarDefault(props: NavBarProps) {
  return (
    <Navbar
      className="fixed bottom-0 left-0 z-50 w-full h-16 bg-primary-color2"
    >
      <div className="flex self-end flex-row justify-around">

        <Typography as="a" href="/" style={{ color: "#ffffff" }}>
          <PresentationChartBarIcon className="h-[25px] w-[25px]" />
        </Typography>

        <Typography as="a" href="myvotes" style={{ color: "#ffffff" }}>
          <Badge invisible={props.unassessed != 0 ? false : true} color='teal' content={props.unassessed}>
            <CheckBadgeIcon className="h-[25px] w-[25px]" />
          </Badge>
        </Typography>

        <Typography as="a" href="achievements" style={{ color: "#ffffff" }}>
          <TrophyIcon className="h-[25px] w-[25px]" />
        </Typography>
        
      </div>
    </Navbar>
  );
}
