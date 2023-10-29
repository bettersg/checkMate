import { Button, Typography } from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { FaceFrownIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VeracitySlider from "./Tier2";

const CATEGORIES = [
  { name: "Scam", icon: <XMarkIcon className="h-7 w-7" /> },
  { name: "Illicit", icon: <ShieldExclamationIcon className="h-7 w-7" /> },
  { name: "News/Info/Opinion", icon: <LightBulbIcon className="h-7 w-7" /> },
  { name: "Spam", icon: <FaceFrownIcon className="h-7 w-7" /> },
  { name: "Trivial", icon: <CheckCircleIcon className="h-7 w-7" /> },
];

export default function VoteCategories() {
  const navigate = useNavigate();
  const [vote, setVote] = useState<string | null>(null);

  const handleVote = (categoryName: string) => {
    setVote(categoryName);
  };

  const handleNext = () => {
    //add in function to set vote to assessed
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
        <div className="">
          <Typography className="mb-3 text-primary-color3" variant="h6">
            You have chosen: {vote}
          </Typography>
          {vote == "News/Info/Opinion" ? <VeracitySlider /> : null}
          <Button
            className="bg-highlight-color"
            onClick={() => handleNext()}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
