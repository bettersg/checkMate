import { Navbar, Badge, Button } from "@material-tailwind/react";
import { useUser } from '../UserContext';
import { useNavigate } from "react-router-dom";
import {
  PresentationChartBarIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

//number of unread msgs from user
interface NavBarProps {
  unread: number
}

export default function NavbarDefault({ unread }: NavBarProps) {
  const { phoneNo } = useUser();
  const navigate = useNavigate();
  // Helper function to decide if the badge is invisible
  const isBadgeInvisible = unread === 0;

  return (
    <Navbar className="fixed bottom-0 left-0 z-50 w-full h-16 bg-primary-color2">
      <div className="flex items-center justify-around h-full">
        <Button variant="text" className="rounded-full"
          onClick={() => navigate('/')}>
          <PresentationChartBarIcon className="h-7 w-7 text-white" />
        </Button>


        <Button variant="text" className="rounded-full"
          onClick={() => navigate(`/checkers/${phoneNo}/messages`)}>
          <Badge invisible={isBadgeInvisible} color='teal' content={unread} placement="top-end">
            <CheckBadgeIcon className="h-7 w-7 text-white" />
          </Badge>
        </Button>


        <Button variant="text" className="rounded-full"
          onClick={() => { navigate('/achievements') }}>
          <TrophyIcon className="h-7 w-7 text-white" />
        </Button>
      </div>
    </Navbar >

  );
}
