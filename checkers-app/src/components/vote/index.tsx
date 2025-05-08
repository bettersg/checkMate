import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../../providers/UserContext";
import Loading from "../common/Loading";
import { Vote } from "../../types";
import { getVote } from "../../services/api";
import CategoryRationalisation from "./Rationalisation";
import VoteResult from "./VoteResult";
import VotingChart from "./VotingChart";
import CustomReply from "./CustomReply";
import CommunityNoteCard from "../myvotes/CommunityNoteCard";
import VotingSystem from "./VotingSystem";
import VotingNoteChart from "./VoteNoteChart";

export default function VotePage() {
  const { checkerDetails } = useUser();
  const { messageId, voteRequestId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [vote, setVote] = useState<Vote | null>(null);
  const [selectedTag, setSelectedTag] = useState<string[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const fetchVote = async () => {
      if (messageId && voteRequestId) {
        const vote = await getVote(messageId, voteRequestId);
        setVote(vote);
        setSelectedTag(vote.tags);
        console.log(vote);
      }
      setIsLoading(false);
    };

    if (messageId && voteRequestId && checkerDetails.checkerId) {
      fetchVote();
    }
  }, [checkerDetails.checkerId]);

  if (isLoading) {
    return <Loading />;
  }

  if (!vote) {
    return null;
  }

  return (
    <>
      <div
        className="grid grid-flow-row items-center gap-2 pb-2 left-right-padding mb-2"
        style={{ maxHeight: "100vh", overflowY: "auto" }}
      >
        <style>
          {`
            ::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        <MessageCard
          type={vote.type}
          text={vote.text}
          imageUrl={vote.signedImageUrl}
          caption={vote.caption}
          sender={vote.sender}
        />

        {vote.communityNote ? (
          <CommunityNoteCard
            en={vote.communityNote.en}
            cn={vote.communityNote.cn}
            links={vote.communityNote.links}
            downvoted={vote.communityNote.downvoted}
          />
        ) : null}

        {vote.category === null ||
        vote.category === "pass" ||
        !vote.isAssessed ? (
          <>
            <VotingSystem
              messageId={messageId ?? null}
              voteRequestId={voteRequestId ?? null}
              currentCategory={vote.category}
              currentTruthScore={vote.truthScore}
              currentTags={selectedTag}
              numberPointScale={vote.numberPointScale}
              currentCommunityNoteCategory={vote.communityNoteCategory}
              communityNote={vote.communityNote}
              isTester={checkerDetails.isTester}
              commentOnNote={vote.commentOnNote ?? null}
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
                  tags={vote.tags}
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
                  tags={vote.finalStats?.tags ?? []}
                />
              </div>
            </div>
            <VotingChart assessedInfo={vote.finalStats} />
            {vote.communityNote ? (
              <VotingNoteChart assessedInfo={vote.finalStats} />
            ) : null}
            <CategoryRationalisation
              rationalisation={vote.finalStats?.rationalisation ?? null}
            />
          </>
        )}
        {checkerDetails.tier === "expert" && (
          <CustomReply messageId={messageId} />
        )}
      </div>
    </>
  );
}
