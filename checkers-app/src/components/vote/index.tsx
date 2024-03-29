import VoteCategories from "./VoteCategories";
import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "../common/BackButton";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../../providers/UserContext";
import Loading from "../common/Loading";
import { Vote } from "../../types";
import { getVote } from "../../services/api";
import CategoryRationalisation from "./Rationalisation";
import VoteResult from "./VoteResult";
import VotingChart from "./VotingChart";

export default function VotePage() {
  const { checkerId } = useUser();
  const { messageId, voteRequestId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [vote, setVote] = useState<Vote | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const fetchVote = async () => {
      if (messageId && voteRequestId) {
        const vote = await getVote(messageId, voteRequestId);
        setVote(vote);
      }
      setIsLoading(false);
    };

    if (messageId && voteRequestId && checkerId) {
      fetchVote();
    }
  }, [checkerId]);

  if (isLoading) {
    return <Loading />;
  }

  if (!vote) {
    return null;
  }

  return (
    <>
      <div className="grid grid-flow-row items-center gap-2 pb-2 left-right-padding">
        <style>
          {`
            ::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        <BackButton />
        <MessageCard
          type={vote.type}
          text={vote.text}
          imageUrl={vote.signedImageUrl}
          caption={vote.caption}
        />
        {vote.category === null || !vote.isAssessed ? (
          <>
            <Typography
              variant="h4"
              className="text-primary-color3 dark:text-white"
            >
              Select category:
            </Typography>
            <VoteCategories
              messageId={messageId ?? null}
              voteRequestId={voteRequestId ?? null}
              currentCategory={vote.category}
              currentTruthScore={vote.truthScore}
            />
          </>
        ) : (
          <>
            <div className="flex w-full gap-x-2">
              <div className="flex flex-1 flex-col justify-center">
                <Typography
                  className="text-primary-color3 text-center dark:text-white"
                  variant="h5"
                >
                  Your Vote
                </Typography>
                <VoteResult
                  category={vote.category}
                  truthScore={vote.truthScore}
                />
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <Typography
                  className="text-primary-color3 text-center dark:text-white"
                  variant="h5"
                >
                  Final Result
                </Typography>
                <VoteResult
                  category={vote.finalStats?.primaryCategory ?? null}
                  truthScore={vote.finalStats?.truthScore ?? null}
                />
              </div>
            </div>
            <VotingChart assessedInfo={vote.finalStats} />
            <CategoryRationalisation
              rationalisation={vote.finalStats?.rationalisation ?? null}
            />
          </>
        )}
      </div>
    </>
  );
}
