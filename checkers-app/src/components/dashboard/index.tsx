import { Typography } from "@material-tailwind/react";
import { useState, useEffect } from "react";
import PendingMessageAlert from "./PendingMsgAlert";
import { useUser } from "../../providers/UserContext";
import StatCard from "./StatsCard";
import { Checker } from "../../types";
import { getChecker } from "../../services/api";
import Loading from "../common/Loading";
//TODO: link to firebase

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const { checkerDetails } = useUser();
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [accuracyRate, setAccuracyRate] = useState<number | null>(0);
  const [avgResponseTime, setAvgResponseTime] = useState<number>(0);
  const [peopleHelped, setPeopleHelped] = useState<number>(0);

  useEffect(() => {
    const fetchChecker = async () => {
      setIsLoading(true);
      if (!checkerDetails.checkerId) {
        return;
      }
      const checker: Checker = await getChecker(checkerDetails.checkerId);
      if (checker) {
        setTotalVotes(checker.last30days.totalVoted);
        setAccuracyRate(checker.last30days.accuracyRate);
        setAvgResponseTime(checker.last30days.averageResponseTime);
        setPeopleHelped(checker.last30days.peopleHelped);
        //setPendingCount(checker.pendingVoteCount);
        setIsLoading(false);
      }
    };
    if (checkerDetails.checkerId) {
      fetchChecker();
    }
  }, [checkerDetails.checkerId]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col gap-y-4 left-right-padding">
      {checkerDetails.pendingCount > 0 && (
        <PendingMessageAlert
          hasPending={true}
          pendingCount={checkerDetails.pendingCount}
        />
      )}
      {/* {reviewCount > 0 && (
        <PendingMessageAlert hasPending={false} pendingCount={pendingCount} />
      )} */}
      <Typography variant="h4" className="text-primary-color">
        In the past 30 days
      </Typography>
      <div className="my-6 flex flex-col gap-y-4 mx-2">
        <StatCard
          name="messages voted on"
          img_src="/votes.png"
          stat={`${totalVotes}`}
        />
        <StatCard
          name="average accuracy rate"
          img_src="/accuracy.png"
          stat={
            accuracyRate === null ? "NA" : `${(accuracyRate * 100).toFixed(1)}%`
          }
        />
        <StatCard
          name="average response time"
          img_src="/response.png"
          stat={`${avgResponseTime.toFixed(0)} mins`}
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
