import { useState } from "react";
import { TrophyIcon } from "@heroicons/react/20/solid";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { Button } from "@material-tailwind/react"
import { ForwardIcon } from "@heroicons/react/24/solid";

interface PropType {
    messageId: string | null;
    voteRequestId: string | null;
    currentCommunityCategory: string | null;
    onNextStep: (value: number) => void;
    onSelectCommunityCategory: (communityCategory: string | null) => void;
}

const CATEGORIES = [
    {
        name: "great",
        icon: <TrophyIcon className = "h-7 w-7" />,
        display: "Great",
        description: "Good response, can't do any better",
    },
    {
        name: "acceptable",
        icon: <CheckBadgeIcon className = "h-7 w-7" />,
        display: "Acceptable",
        description: "Acceptable response, but can be improved"
    },
    {
        name: "unacceptable",
        icon: <XCircleIcon className="h-7 w-7" />,
        display: "Unacceptable",
        description: "Unacceptable response"
    }
]


export default function CommunityNoteCategories(Prop: PropType) {
    const currentCategory = Prop.currentCommunityCategory
    const messageId = Prop.messageId;
    const voteRequestId = Prop.voteRequestId;
    const [selectedCategory, setSelectedCategory] = useState<string | null>(currentCategory);
    const [communityCategory, setCommunityCategory] = useState<string | null>(currentCategory);

    const handleCommunityCategoryChange = (category: string) => {
        switch(category) {
            default:
                setCommunityCategory(category);
                Prop.onSelectCommunityCategory(category);
                break;
        }
    }

    const handleSelection = (categoryName: string) => {
        setSelectedCategory(categoryName);
        handleCommunityCategoryChange(categoryName);
    }

    const handleNextStep = (value: number) => {
        Prop.onNextStep(value)
    }

    return (
      <div className="grid grid-flow-row gap-y-4 items-center">
        {CATEGORIES.map((cat, index) => (
            <>
              <Button
                className={`flex flex-row items-center justify-start gap-2 max-w-md space-x-3 text-sm
                ${
                  selectedCategory === cat.name
                  ? "bg-primary-color3"
                  : "bg-primary-color"}`}
                key={index}
                onClick={() => handleSelection(cat.name)}
              >
                {cat.icon}
                {cat.display}
              </Button>
            </>
        ))}

        {communityCategory ? (
            <Button fullWidth className="flex items-center justify-center gap-3 bg-green-400" size="sm"
                onClick = {() => handleNextStep(2)}
                >
                Move to next step
                <ForwardIcon className="h-5 w-5"/>
            </Button>
        ) : null}  
      </div>
    )
}
