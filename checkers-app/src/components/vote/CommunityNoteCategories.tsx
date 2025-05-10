import { useState } from "react";
import { TrophyIcon } from "@heroicons/react/20/solid";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@material-tailwind/react";
import { TooltipWithHelperIcon } from "../common/ToolTip";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  currentCommunityCategory: string | null;
  commentOnNote: string;
  onNextStep: (value: number) => void;
  onSelectCommunityCategory: (communityCategory: string | null) => void;
  onCommentOnNote: (commentOnNote: string) => void;
}

const CATEGORIES = [
  {
    name: "great",
    icon: <TrophyIcon className="h-7 w-7" />,
    display: "Great",
    description: "Helpful, informative, and concise reply. Nothing to nitpick.",
  },
  {
    name: "acceptable",
    icon: <CheckBadgeIcon className="h-7 w-7" />,
    display: "Acceptable",
    description: "Could be improved in style/susbstance, but contains no inaccuracy.",
  },
  {
    name: "unacceptable",
    icon: <XCircleIcon className="h-7 w-7" />,
    display: "Unacceptable",
    description: "Contains information, or conveys a message, that is outright wrong/untrue.",
  },
];

export default function CommunityNoteCategories(Prop: PropType) {
  const currentCategory = Prop.currentCommunityCategory;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    currentCategory
  );
  const [_, setCommunityCategory] = useState<string | null>(currentCategory);

  const handleCommunityCategoryChange = (category: string) => {
    switch (category) {
      default:
        setCommunityCategory(category);
        Prop.onSelectCommunityCategory(category);
        break;
    }
  };

  const handleSelection = (categoryName: string) => {
    setSelectedCategory(categoryName);
    handleCommunityCategoryChange(categoryName);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    Prop.onCommentOnNote(event?.target.value);
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
        </>
      ))}

      <div className="relative w-full min-w-[200px]">
        <textarea
          rows={6}
          value={Prop.commentOnNote}
          onChange={handleInputChange}
          className="peer h-full min-h-[100px] w-full resize-none rounded-[7px] border border-blue-gray-200 border-t-transparent bg-transparent px-3 py-2.5 font-sans text-sm font-normal text-blue-gray-700 outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-blue-gray-200 placeholder-shown:border-t-blue-gray-200 focus:border-2 focus:border-gray-900 focus:border-t-transparent focus:outline-0"
          placeholder=" "
        />
        <label className="before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight text-blue-gray-400 transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-blue-gray-200 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-blue-gray-200 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-blue-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-900 peer-focus:before:border-t-2 peer-focus:before:border-l-2 peer-focus:before:!border-gray-900 peer-focus:after:border-t-2 peer-focus:after:border-r-2 peer-focus:after:!border-gray-900">
          [Optional] Comments, if any.
        </label>
      </div>
    </div>
  );
}
