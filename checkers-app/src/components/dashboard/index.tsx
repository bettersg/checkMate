import { Typography } from "@material-tailwind/react";
import { useState, useEffect } from "react";
import PendingMessageAlert from "./PendingMsgAlert";
import { useUser } from "../../providers/UserContext";
import StatCard from "./StatsCard";
import ProgressCard from "./ProgressCard";
import { Checker, ProgramStats } from "../../types";
import { getChecker } from "../../services/api";
import Loading from "../common/Loading";
import { CelebrationDialog } from "./CelebrationDialog";
//TODO: link to firebase

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const { checkerDetails, setCheckerDetails } = useUser();
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [accuracyRate, setAccuracyRate] = useState<number | null>(0);
  const [avgResponseTime, setAvgResponseTime] = useState<number>(0);
  const [peopleHelped, setPeopleHelped] = useState<number>(0);
  const [isOnProgram, setIsOnProgram] = useState<boolean>(false);
  const [hasCompletedProgram, setHasCompletedProgram] =
    useState<boolean>(false);
  const [programStats, setProgramStats] = useState<null | ProgramStats>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const isProd = import.meta.env.MODE === "production";

  useEffect(() => {
    const fetchChecker = async () => {
      setIsLoading(true);
      if (!checkerDetails.checkerId) {
        return;
      }
      const checker: Checker = await getChecker(checkerDetails.checkerId);
      if (checker) {
        setCheckerDetails((prev) => ({ ...prev, isActive: checker.isActive }));
        if (checker.last30days) {
          setTotalVotes(checker.last30days.totalVoted);
          setAccuracyRate(checker.last30days.accuracyRate);
          setAvgResponseTime(checker.last30days.averageResponseTime);
          setPeopleHelped(checker.last30days.peopleHelped);
          setIsLoading(false);
        }
        if (checker.isOnProgram && checker.programStats) {
          setIsOnProgram(checker.isOnProgram);
          setHasCompletedProgram(checker.hasCompletedProgram);
          setProgramStats(checker.programStats);
        }
        if (checker.referralCode) {
          setReferralCode(checker.referralCode);
        }
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
      <CelebrationDialog
        display={hasCompletedProgram && isOnProgram}
      ></CelebrationDialog>
      {/* {reviewCount > 0 && (
        <PendingMessageAlert hasPending={false} pendingCount={pendingCount} />
      )} */}
      {isOnProgram && programStats ? (
        <div>
          <Typography variant="h4" className="text-primary-color">
            CheckMate Program Progress
          </Typography>
          <div className="my-6 flex flex-col gap-y-4 mx-2">
            <ProgressCard
              name="Messages Voted On"
              img_src="/votes.png"
              current={programStats.numVotes}
              target={programStats.numVotesTarget}
              tooltip_header="Messages Voted On"
              tooltip_description="Number of messages that you have voted on (passing does not count)"
            />
            <ProgressCard
              name="Voting Accuracy"
              img_src="/accuracy.png"
              current={
                programStats.accuracy === null ? 0 : programStats.accuracy * 100
              }
              target={programStats.accuracyTarget * 100}
              tooltip_header="Voting Accuracy (%)"
              tooltip_description="Your accuracy for votes that did not end up as the unsure category"
            />
            {programStats.numReportTarget > 0 && (
              <ProgressCard
                name="Messages Reported"
                img_src="/message.png"
                current={programStats.numReports}
                target={programStats.numReportTarget}
                tooltip_header="Messages Reported"
                tooltip_description={
                  <>
                    Report messages via our{" "}
                    <a
                      href={
                        isProd
                          ? "https://wa.me/6580432188"
                          : "https://wa.me/6586177848"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      WhatsApp Bot
                    </a>
                    .
                  </>
                }
              />
            )}
            {programStats.numReferralTarget > 0 && (
              <ProgressCard
                name="New Users Referred"
                img_src="/referral.png"
                current={programStats.numReferrals}
                target={programStats.numReferralTarget}
                tooltip_header="Number of Referrals"
                tooltip_description="Your accuracy for votes that did not end up as the unsure category"
                referral_code={referralCode}
              />
            )}
          </div>
        </div>
      ) : (
        <div>
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
                accuracyRate === null
                  ? "NA"
                  : `${(accuracyRate * 100).toFixed(1)}%`
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
      )}
    </div>
  );
}
