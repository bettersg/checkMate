import { XCircleIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/20/solid";
import { FaceSmileIcon } from "@heroicons/react/20/solid";
import { PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { MegaphoneIcon } from "@heroicons/react/24/solid";
import { EllipsisHorizontalCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@material-tailwind/react";
import { patchVote } from "../../services/api";
import { useUser } from "../../providers/UserContext";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import { Typography } from "@material-tailwind/react";
import VoteTags from "./VoteTags";
import InfoOptions from "./InfoOptions";
import NVCOptions from "./NvcOptions";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  currentCategory: string | null;
  currentTruthScore: number | null;
  currentTags: string[] | null;
  numberPointScale: number;
}

function getSelectedCategory(primaryCategory: string | null) {
  switch (primaryCategory) {
    case "irrelevant":
      return "nvc";
    case "legitimate":
      return "nvc";
    default:
      return primaryCategory;
  }
}

const CATEGORIES = [
  {
    name: "scam",
    icon: <XCircleIcon className="h-7 w-7" />,
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
      "Content intended to inform/convince/mislead a broad base of people",
  },
  {
    name: "satire",
    icon: <FaceSmileIcon className="h-7 w-7" />,
    display: "Satire",
    description: "Content clearly satirical in nature",
  },
  {
    name: "spam",
    icon: <MegaphoneIcon className="h-7 w-7" />,
    display: "Marketing/Spam",
    description:
      "Content intended to (i) promote or publicise a non-malicious product, service or event or (ii) convince recipient to spread non-malicious messages to others",
  },
  {
    name: "nvc",
    icon: <EllipsisHorizontalCircleIcon className="h-7 w-7" />,
    display: "No Verifiable Content",
    description:
      "Content that isn't capable of being checked using publicly-available information due to its nature",
  },
  {
    name: "unsure",
    icon: <QuestionMarkCircleIcon className="h-7 w-7" />,
    display: "Unsure",
    description:
      "Either (i) Needs more information from sender to assess, or (ii) a search of publicly available information yields no useful results",
  },
  {
    name: "pass",
    icon: <PaperAirplaneIcon className="h-7 w-7" />,
    display: "Pass",
    description: "Skip this message if you're really unable to assess it",
  },
];

export default function VoteCategories(Prop: PropType) {
  const navigate = useNavigate();
  const { incrementSessionVotedCount } = useUser();

  const currentCategory = Prop.currentCategory;
  const currentTruthScore = Prop.currentTruthScore;
  const currentTags = Prop.currentTags ?? [];
  const messageId = Prop.messageId;
  const voteRequestId = Prop.voteRequestId;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    getSelectedCategory(currentCategory)
  );
  const [voteCategory, setVoteCategory] = useState<string | null>(
    currentCategory
  );
  //take global values from user context
  const [truthScore, setTruthScore] = useState<number | null>(
    currentTruthScore
  );
  const [tags, setTags] = useState<string[]>(currentTags);

  const handleTruthScoreChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTruthScore(Number(event.target.value));
  };

  const handleL2VoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleVoteCategoryChange(event.target.value);
  };

  const handleVoteCategoryChange = (category: string) => {
    switch (category) {
      default:
        setVoteCategory(category);
        break;
    }
  };

  const handleSelection = (categoryName: string) => {
    setSelectedCategory(categoryName);

    switch (categoryName) {
      case "nvc":
        setVoteCategory("nvc");
        break;
      default:
        handleVoteCategoryChange(categoryName);
        break;
    }
  };

  //function to update vote request in firebase
  const handleSubmitVote = (
    category: string,
    truthScore: number | null,
    tags: string[] | null
  ) => {
    if (category === "nvc") {
      return;
    }
    if (messageId && voteRequestId) {
      //call api to update vote
      patchVote(
        messageId,
        voteRequestId,
        category,
        category === "info" ? truthScore : null,
        tags
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

  const onSelectTagOption = (tags: string[]) => {
    setTags(tags);
    console.log(tags);
  };

  return (
    <div className="grid grid-flow-row gap-y-4 items-center">
      <Typography variant="h4" className="text-primary-color3 dark:text-white">
        Select category:
      </Typography>
      {CATEGORIES.map((cat, index) => (
        <>
          <Button
            className={`flex flex-row items-center justify-start gap-2 max-w-md space-x-3 text-sm
            ${
              selectedCategory === cat.name
                ? "bg-primary-color3"
                : "bg-primary-color"
            }`}
            key={index}
            onClick={() => handleSelection(cat.name)}
          >
            {cat.icon}
            {cat.display}
            <TooltipWithHelperIcon
              header={cat.display}
              text={cat.description}
            />
          </Button>
          {/* Conditionally render InfoOptions right after the "info" button if it has been selected */}
          {selectedCategory === "info" && cat.name === "info" && (
            <InfoOptions
              selectedTruthScore={truthScore}
              numberPointScale={Prop.numberPointScale}
              handleTruthScoreChange={handleTruthScoreChange}
            />
          )}
          {selectedCategory === "nvc" && cat.name === "nvc" && (
            <NVCOptions
              selectedCategory={voteCategory}
              onChange={handleL2VoteChange}
            />
          )}
        </>
      ))}

      <VoteTags tags={tags} onSelectTag={onSelectTagOption} />

      {voteCategory ? (
        <div className="place-self-center grid grid-flow-row gap-y-4 w-full">
          <Button
            className="bg-highlight-color w-fit place-self-center"
            onClick={() => handleSubmitVote(voteCategory, truthScore, tags)}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
