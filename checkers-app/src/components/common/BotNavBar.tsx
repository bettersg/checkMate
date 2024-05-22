import { Navbar, Badge, Button } from "@material-tailwind/react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../providers/UserContext";
import {
  PresentationChartBarIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

export default function NavbarDefault() {
  const navigate = useNavigate();
  const { checkerDetails } = useUser();
  // Helper function to decide if the badge is invisible
  const isBadgeInvisible = checkerDetails.pendingCount === 0;

  return (
    <Navbar className="fixed bottom-0 left-0 z-50 w-full h-16 bg-primary-color2 dark:bg-dark-highlight-color border-0">
      <div className="flex items-center justify-around h-full">
        <Button
          variant="text"
          className="rounded-full"
          onClick={() => navigate("/")}
          ripple
        >
          <PresentationChartBarIcon className="h-7 w-7 text-white" />
        </Button>

        <Button
          variant="text"
          className="rounded-full"
          onClick={() => navigate(`/votes`)}
          ripple
        >
          <Badge
            invisible={isBadgeInvisible}
            color="teal"
            content={checkerDetails.pendingCount}
            placement="top-end"
          >
            <CheckBadgeIcon className="h-7 w-7 text-white" />
          </Badge>
        </Button>

        <Button
          variant="text"
          className="rounded-full"
          onClick={() => {
            navigate("/leaderboard");
          }}
          ripple
        >
          <TrophyIcon className="h-7 w-7 text-white" />
        </Button>
      </div>
    </Navbar>
  );
}
