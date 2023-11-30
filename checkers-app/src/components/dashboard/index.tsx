import PendingMessageAlert from "./PendingMsgAlert";

import { useUser } from "../../UserContext";
import StatCard from "./StatsCard";
import { Typography } from "@material-tailwind/react";

//TODO: link to firebase
const STATS_CAT = [
  { name: "total votes", img_src: "/votes.png", stat: "100" },
  { name: "average accuracy rate", img_src: "/accuracy.png", stat: "100%" },
  { name: "average response time", img_src: "/response.png", stat: "90s" },
  { name: "people helped", img_src: "/users_helped.png", stat: "88" }
];

export default function Dashboard() {
  const { unassessed, unchecked } = useUser();

  return (
    <div className="flex flex-col gap-y-4">
    {unassessed > 0 && <PendingMessageAlert Type={true} />}
    {unchecked > 0 && <PendingMessageAlert Type={false} />}
      <Typography variant="h4" className="text-primary-color">
        In the past 30 days
      </Typography>
      <div className="my-6 flex flex-col gap-y-4 mx-2">
        {STATS_CAT.map((props) => (
          <StatCard
            key={props.name}
            name={props.name}
            img_src={props.img_src}
            stat={props.stat}
          />
        ))}
      </div>
    </div>
  );
}
