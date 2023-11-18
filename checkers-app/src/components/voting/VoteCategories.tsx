import { Button, Typography } from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { FaceFrownIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VeracitySlider from "./Tier2";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { HandThumbUpIcon } from "@heroicons/react/20/solid";
import { useUser } from '../../UserContext';

interface PropType {
  msgId: string | undefined;
  voteCategory: string | null;
}

const CATEGORIES = [
  { name: "Scam", icon: <XMarkIcon className="h-7 w-7" /> },
  { name: "Illicit", icon: <ShieldExclamationIcon className="h-7 w-7" /> },
  { name: "News/Info/Opinion", icon: <LightBulbIcon className="h-7 w-7" /> },
  { name: "Spam", icon: <FaceFrownIcon className="h-7 w-7" /> },
  { name: "Trivial", icon: <CheckCircleIcon className="h-7 w-7" /> },
  { name: "Unsure", icon: <QuestionMarkCircleIcon className="h-7 w-7" /> },
  { name: "Legitimate", icon: <HandThumbUpIcon className="h-7 w-7" /> }
];

export default function VoteCategories(Prop: PropType) {
  const navigate = useNavigate();
  const initialVote = Prop.voteCategory != null ? Prop.voteCategory : null;
  const [vote, setVote] = useState<string | null>(initialVote);
  const { userId } = useUser();

  const handleVote = (categoryName: string) => {
    setVote(categoryName);
  };

  const handleNext = (vote: string, msgId: string | undefined) => {
    //add in function to set vote to assessed
    if (userId && msgId) {
      const fetchData = async () => {
        try {
          fetch("/api/vote", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, msgId, vote }),
          });
          console.log("Data sent successfully");
        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
    else {
      console.log("Error: userId or msgId is null")
    }
    navigate("/myvotes");
  };

  return (
    <div className="grid grid-flow-row gap-y-4 items-center">
      {CATEGORIES.map((category, index) => (
        <Button
          className="flex flex-row items-center justify-start gap-2 max-w-md space-x-3 bg-primary-color text-sm"
          key={index}
          onClick={() => handleVote(category.name)}
        >
          {category.icon}
          {category.name}
        </Button>
      ))}

      {vote ? (
        <div className="place-self-center place-items-center flex flex-col">
          <Typography className="mb-3 text-primary-color3" variant="h6">
            You have chosen: {vote}
          </Typography>
          {vote == "News/Info/Opinion" ? <VeracitySlider /> : null}
          <Button
            className="bg-highlight-color w-fit"
            onClick={() => handleNext(vote, Prop.msgId)}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
