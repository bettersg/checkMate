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

export default function NavbarDefault({unassessed}: NavBarProps) {
  // Helper function to decide if the badge is invisible
  const isBadgeInvisible = unassessed === 0;

  return (
    <Navbar className="fixed bottom-0 left-0 z-50 w-full h-16 bg-primary-color2">
      <div className="flex items-center justify-around h-full">
        <Typography as="a" href="/" className="text-background-color h-full flex items-center">
          <PresentationChartBarIcon className="h-7 w-7" />
        </Typography>

        <Typography as="a" href="/myvotes" className="text-background-color h-full flex items-center">
          <Badge invisible={isBadgeInvisible} color='teal' content={unassessed} placement="top-end">
            <CheckBadgeIcon className="h-7 w-7" />
          </Badge>
        </Typography>

        <Typography as="a" href="/achievements" className="text-background-color h-full flex items-center">
          <TrophyIcon className="h-7 w-7" />
        </Typography>
      </div>
    </Navbar>

  );
}
