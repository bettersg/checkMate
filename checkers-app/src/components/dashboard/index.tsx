import { Typography } from "@material-tailwind/react";
import { useState, useEffect } from "react";
import PendingMessageAlert from "./PendingMsgAlert";
import { useUser } from "../../providers/UserContext";
import StatCard from "./StatsCard";
import ProgressCard from "./ProgressCard";
import { Checker, ProgramStats } from "../../types";
import { getChecker, withdrawCheckerProgram } from "../../services/api";
import Loading from "../common/Loading";
import { CelebrationDialog } from "./CelebrationDialog";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
} from "@material-tailwind/react";

export default function Dashboard() {
  const navigate = useNavigate();
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
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleOpen = () => setDialogOpen(!dialogOpen);
  const handleConfirm = async () => {
    if (!checkerDetails.checkerId) {
      return;
    }
    await withdrawCheckerProgram(checkerDetails.checkerId);
    setDialogOpen(false);
    navigate(0);
  };
  const isProd = import.meta.env.MODE === "production";

  useEffect(() => {
    const fetchChecker = async () => {
      setIsLoading(true);
      if (!checkerDetails.checkerId) {
        return;
      }
      const checker: Checker = await getChecker(checkerDetails.checkerId);
      console.log("Checker details fetched:", checker); // Log the entire checker object
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
          setCertificateUrl(checker.certificateUrl || null);
          console.log("Certificate URL fetched:", checker.certificateUrl);
        }
        if (checker.referralCode) {
          setReferralCode(checker.referralCode);
        }
      } else {
        console.log("Checker data not found");
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
        certificateUrl={certificateUrl}
      />
      {isOnProgram && programStats ? (
        <div>
          <Typography variant="h6" className="text-primary-color">
            Up for a challenge? Attain these 3 milestones to finish the
            CheckMate Checker's Program and get certified.
          </Typography>
          <div className="my-6 flex flex-col gap-y-4 mx-2">
            {/* Progress Cards for program milestones */}
            <ProgressCard
              name="Messages Voted On"
              img_src="/votes.png"
              current={programStats.numVotes}
              target={programStats.numVotesTarget}
              isPercentageTarget={false}
              tooltip_header="Messages Voted On"
              tooltip_description={`Number of messages that you have voted on (passing does not count). You need to vote on at least ${programStats.numVotesTarget} messages.`}
            />
            <ProgressCard
              name="Voting Accuracy"
              img_src="/accuracy.png"
              current={
                programStats.accuracy === null ? 0 : programStats.accuracy * 100
              }
              target={programStats.accuracyTarget * 100}
              isPercentageTarget={true}
              tooltip_header="Voting Accuracy (%)"
              tooltip_description={`% of your votes that match the majority vote. You need to obtain at least ${
                programStats.accuracyTarget * 100
              }% accuracy. Messages where the majority category does not receive 50% of the votes are excluded from this calculation.`}
            />
            {/* Additional progress cards for reporting and referrals */}
            {programStats.numReportTarget > -1 && (
              <ProgressCard
                name="Messages Reported"
                img_src="/message.png"
                current={programStats.numReports}
                target={programStats.numReportTarget}
                isPercentageTarget={false}
                tooltip_header="Messages Reported"
                tooltip_description={
                  <>
                    Number of messages that you have submitted to our{" "}
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
                    . You need to submit at least $
                    {programStats.numReportTarget} messages
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
                tooltip_description="Number of people you have referred to join CheckMate"
                referral_code={referralCode}
              />
            )}
          </div>
          {/* Withdrawal option for users */}
          <Typography className="text-primary-color">
            Not keen on the program?{" "}
            <a
              href="#"
              onClick={handleOpen}
              className="text-blue-500 underline"
            >
              Withdraw
            </a>{" "}
            to participate in just the regular checking.
          </Typography>
          {/* Confirmation dialog for withdrawal */}
          <Dialog open={dialogOpen} handler={handleOpen}>
            <DialogHeader>Withdrawal Confirmation</DialogHeader>
            <DialogBody>
              Please confirm that you would like to withdraw from the program.
              If you are keen to restart the program in future, you can do so at
              the menu bar accessible from the top right.
            </DialogBody>
            <DialogFooter>
              <Button
                variant="text"
                color="red"
                onClick={handleOpen}
                className="mr-1"
              >
                <span>Cancel</span>
              </Button>
              <Button variant="gradient" color="green" onClick={handleConfirm}>
                <span>Confirm</span>
              </Button>
            </DialogFooter>
          </Dialog>
        </div>
      ) : (
        <div>
          {/* Display stats for users not on the program */}
          <Typography variant="h5" className="text-primary-color">
            In the past 30 days
          </Typography>
          <div className="my-6 flex flex-col gap-y-4 mx-2">
            <StatCard
              name="people helped"
              img_src="/users_helped.png"
              stat={`${peopleHelped}`}
            />
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
          </div>
        </div>
      )}
    </div>
  );
}
