import { Typography } from "@material-tailwind/react";
import { LeaderboardTable } from "./table";

export default function Leaderboard() {
  return (
    <div className="left-right-padding">
      <Typography color="blue-gray" className="font-normal">
        Refreshes every month
      </Typography>
      <LeaderboardTable />
    </div>
  );
}
