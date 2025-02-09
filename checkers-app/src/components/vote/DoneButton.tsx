import { Button } from "@material-tailwind/react";
import { patchVote } from "../../services/api";
import { useUser } from "../../providers/UserContext";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  communityCategory: string | null;
  voteCategory: string | null;
  truthScore: number | null;
  tags: string[];
  commentOnNote: string;
}

export default function DoneButton(Prop: PropType) {
  const navigate = useNavigate();
  const { incrementSessionVotedCount } = useUser();
  const messageId = Prop.messageId;
  const voteRequestId = Prop.voteRequestId;
  const communityCategory = Prop.communityCategory;
  const voteCategory = Prop.voteCategory;
  const truthScore = Prop.truthScore;
  const tags = Prop.tags;
  const commentOnNote = Prop.commentOnNote || null;

  // function to update vote request in firebase
  const handleSubmitVote = (
    comCategory: string | null,
    category: string | null,
    truthScore: number | null,
    tags: string[] | null,
    commentOnNote: string | null
  ) => {
    if (category === "nvc") {
      return;
    }
    if (messageId && voteRequestId) {
      // call api to update vote
      patchVote(
        messageId,
        voteRequestId,
        category,
        comCategory,
        category === "info" ? truthScore : null,
        tags,
        commentOnNote || null
      )
        .then(() => {
          incrementSessionVotedCount();
          navigate("/votes");
        })
        .catch((error) => {
          console.error("Error updating vote: ", error);
        });
    }
  };

  return (
    <Button
      fullWidth
      className="mt-3 flex items-center justify-center gap-3 bg-highlight-color"
      size="sm"
      onClick={() =>
        handleSubmitVote(
          communityCategory,
          voteCategory,
          truthScore,
          tags,
          commentOnNote
        )
      }
    >
      <CheckCircleIcon className="h-5 w-5" />
      Done!
    </Button>
  );
}
