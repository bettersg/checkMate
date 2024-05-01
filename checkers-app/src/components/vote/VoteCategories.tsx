import { XMarkIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { FaceFrownIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { HandThumbUpIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/20/solid";
import { FaceSmileIcon } from "@heroicons/react/20/solid";
import { PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@material-tailwind/react";
import { patchVote } from "../../services/api";
import { useUser } from "../../providers/UserContext";
import { TooltipWithHelperIcon } from "../common/ToolTip";

import InfoOptions from "./Tier2";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  currentCategory: string | null;
  currentTruthScore: number | null;
}

const CATEGORIES = [
  {
    name: "scam",
    icon: <XMarkIcon className="h-7 w-7" />,
    display: "Scam",
    description: "Intended to obtain money/personal information via deception",
  },
  {
    name: "illicit",
    icon: <ShieldExclamationIcon className="h-7 w-7" />,
    display: "Illicit",
    description:
      "Other potential illicit activity, e.g. moneylending/prostitution",
  },
  {
    name: "info",
    icon: <NewspaperIcon className="h-7 w-7" />,
    display: "News/Info/Opinion",
    description:
      "Messages intended to inform/convince/mislead a broad base of people",
  },
  {
    name: "satire",
    icon: <FaceSmileIcon className="h-7 w-7" />,
    display: "Satire",
    description: "Content clearly satirical in nature",
  },
  {
    name: "spam",
    icon: <FaceFrownIcon className="h-7 w-7" />,
    display: "Spam",
    description: "Unsolicited spam, such as marketing messages",
  },
  {
    name: "legitimate",
    icon: <HandThumbUpIcon className="h-7 w-7" />,
    display: "Legitimate",
    description:
      "Legitimate source but can't be assessed, e.g. transactional messages",
  },
  {
    name: "irrelevant",
    icon: <CheckCircleIcon className="h-7 w-7" />,
    display: "Trivial",
    description: "Trivial/banal messages with nothing to assess",
  },
  {
    name: "unsure",
    icon: <QuestionMarkCircleIcon className="h-7 w-7" />,
    display: "Unsure",
    description: "Insufficient information to determine",
  },
  {
    name: "pass",
    icon: <PaperAirplaneIcon className="h-7 w-7" />,
    display: "Pass",
    description: "Skip assessing this message, if you must",
  },
];

export default function VoteCategories(Prop: PropType) {
  const navigate = useNavigate();
  const { incrementSessionVotedCount } = useUser();

  const currentCategory = Prop.currentCategory;
  const currentTruthScore = Prop.currentTruthScore;
  const messageId = Prop.messageId;
  const voteRequestId = Prop.voteRequestId;
  const [category, setCategory] = useState<string | null>(currentCategory);
  //take global values from user context
  const [truthScore, setTruthScore] = useState<number | null>(
    currentTruthScore
  );

  const handleTruthScoreChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTruthScore(Number(event.target.value));
  };

  const handleVote = (categoryName: string) => {
    setCategory(categoryName);
  };

  //function to update vote request in firebase
  const handleSubmitVote = (category: string, truthScore: number | null) => {
    if (messageId && voteRequestId) {
      //call api to update vote
      patchVote(
        messageId,
        voteRequestId,
        category,
        category === "info" ? truthScore : null
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
    <div className="grid grid-flow-row gap-y-4 items-center">
      {CATEGORIES.map((cat, index) => (
        <>
          <Button
            className={`flex flex-row items-center justify-start gap-2 max-w-md space-x-3 text-sm
            ${
              category === cat.name ? "bg-primary-color3" : "bg-primary-color"
            }`}
            key={index}
            onClick={() => handleVote(cat.name)}
          >
            {cat.icon}
            {cat.display}
            <TooltipWithHelperIcon
              header={cat.display}
              text={cat.description}
            />
          </Button>
          {/* Conditionally render InfoOptions right after the "info" button if it has been selected */}
          {category === "info" && cat.name === "info" && (
            <InfoOptions
              selectedTruthScore={truthScore}
              handleTruthScoreChange={handleTruthScoreChange}
            />
          )}
        </>
      ))}

      {category ? (
        <div className="place-self-center grid grid-flow-row gap-y-4 w-full">
          <Button
            className="bg-highlight-color w-fit place-self-center"
            onClick={() => handleSubmitVote(category, truthScore)}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
