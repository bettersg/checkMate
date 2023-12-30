import { Typography } from "@material-tailwind/react";
import { useState, useEffect } from "react";
import PendingMessageAlert from "./PendingMsgAlert";
import { useUser } from "../../UserContext";
import StatCard from "./StatsCard";
import { Message } from "../../types";
//TODO: link to firebase


export default function Dashboard() {
  const { unassessed, unchecked, assessed } = useUser();
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [accuracyRate, setAccuracyRate] = useState<number>(0);
  const [avgResponseTime, setAvgResponseTime] = useState<number>(0);
  const [peopleHelped, setPeopleHelped] = useState<number>(0);

  useEffect(() => {

    const votes = assessed.length;
    setTotalVotes(votes);

    const matched = assessed.filter((msg: Message) => msg.voteRequests.category == msg.primaryCategory);
    const accuracyRate = (matched.length / assessed.length) * 100;
    setAccuracyRate(parseFloat(accuracyRate.toFixed(2)));

    const responseTimes = assessed.map((msg: Message) => {
      if (msg.voteRequests.acceptedTimestamp && msg.voteRequests.createdTimestamp && msg.voteRequests.acceptedTimestamp.toMillis && msg.voteRequests.createdTimestamp.toMillis) {
        const millisecondsTime = msg.voteRequests.acceptedTimestamp.toMillis() - msg.voteRequests.createdTimestamp.toMillis();
        return millisecondsTime / 1000;
      } else {
        return 0; // or any other default value
      }
    });
    const sum = responseTimes.reduce((a, b) => a + b, 0);
    setAvgResponseTime(sum / responseTimes.length);

    setPeopleHelped(0);

  }, [assessed])

  return (
    <div className="flex flex-col gap-y-4 left-right-padding">
    {unassessed > 0 && <PendingMessageAlert Type={true} />}
    {unchecked > 0 && <PendingMessageAlert Type={false} />}
      <Typography variant="h4" className="text-primary-color">
        In the past 30 days
      </Typography>
      <div className="my-6 flex flex-col gap-y-4 mx-2">
        <StatCard
          name="total votes"
          img_src="/votes.png"
          stat={`${totalVotes}`}
        />
        <StatCard
          name="average accuracy rate"
          img_src="/accuracy.png"
          stat={`${accuracyRate}%`}
        />
        <StatCard
          name="average response time"
          img_src="/response.png"
          stat={`${avgResponseTime}s`}
        />
        <StatCard
          name="people helped"
          img_src="/users_helped.png"
          stat={`${peopleHelped}`}
        />
      </div>
    </div>
  );
}
