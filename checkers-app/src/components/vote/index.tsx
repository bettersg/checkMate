import VoteCategories from "./VoteCategories";
import MessageCard from "../common/MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "../common/BackButton";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Vote } from "../../types";
import { getVote } from "../../services/api";

export default function VotePage() {
  const { messageId, voteRequestId } = useParams();
  const [vote, setVote] = useState<Vote | null>(null);

  useEffect(() => {
    const fetchVote = async () => {
      if (messageId && voteRequestId) {
        const vote = await getVote(messageId, voteRequestId);
        setVote(vote);
      }
    };

    if (messageId && voteRequestId) {
      fetchVote();
    }
  }, []);

  return (
    <>
      {!vote ? null : (
        <div className="grid grid-flow-row items-center gap-2 pb-2 left-right-padding">
          <BackButton />
          <MessageCard
            type={vote.type}
            text={vote.text}
            imageUrl={vote.signedImageUrl}
            caption={vote.caption}
          />
          <Typography variant="h4" className="text-primary-color3">
            Select category:
          </Typography>
          <VoteCategories
            messageId={messageId ?? null}
            voteRequestId={voteRequestId ?? null}
            currentCategory={vote.category}
            currentTruthScore={vote.truthScore}
          />
        </div>
      )}
    </>
  );
}
