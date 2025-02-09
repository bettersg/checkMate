import { XCircleIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/20/solid";
import { FaceSmileIcon } from "@heroicons/react/20/solid";
import { PaperAirplaneIcon } from "@heroicons/react/20/solid";
import { MegaphoneIcon } from "@heroicons/react/24/solid";
import { EllipsisHorizontalCircleIcon } from "@heroicons/react/24/solid";
import { ForwardIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { Button } from "@material-tailwind/react";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import InfoOptions from "./InfoOptions";
import NVCOptions from "./NvcOptions";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  currentCategory: string | null;
  currentTruthScore: number | null;
  currentTags: string[] | null;
  numberPointScale: number;
  onNextStep: (value: number) => void;
  onVoteCategorySelection: (value: string) => void;
  onTruthScoreChange: (value: number | null) => void;
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
  const currentCategory = Prop.currentCategory;
  const currentTruthScore = Prop.currentTruthScore;
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

  const handleTruthScoreChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setTruthScore(Number(event.target.value));
    Prop.onTruthScoreChange(Number(event.target.value));
  };

  const handleL2VoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleVoteCategoryChange(event.target.value);
    handleNextStep(2);
  };

  const handleVoteCategoryChange = (category: string) => {
    switch (category) {
      default:
        setVoteCategory(category);
        Prop.onVoteCategorySelection(category);
        handleNextStep(2);
        break;
    }
  };

  const handleSelection = (categoryName: string) => {
    setSelectedCategory(categoryName);

    switch (categoryName) {
      case "nvc":
        setVoteCategory("nvc");
        Prop.onVoteCategorySelection(categoryName);
        break;
      default:
        handleVoteCategoryChange(categoryName);
        break;
    }
  };

  const handleNextStep = (value: number) => {
    Prop.onNextStep(value);
  };

  return (
    <div className="grid grid-flow-row gap-y-4 items-center">
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
      {/* {voteCategory ? (
        <Button
          fullWidth
          className="flex items-center justify-center gap-3 bg-green-400"
          size="sm"
          onClick={() => handleNextStep(2)}
        >
          Move to next step
          <ForwardIcon className="h-5 w-5" />
        </Button>
      ) : null} */}
    </div>
  );
}
