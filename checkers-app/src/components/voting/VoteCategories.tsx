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
  { name: "Scam", icon: <XMarkIcon className="h-6 w-6" /> },
  { name: "Illicit", icon: <ShieldExclamationIcon className="h-6 w-6" /> },
  { name: "News/Info/Opinion", icon: <LightBulbIcon className="h-6 w-6" /> },
  { name: "Spam", icon: <FaceFrownIcon className="h-6 w-6" /> },
  { name: "Trivial", icon: <CheckCircleIcon className="h-6 w-6" /> },
];

export default function VoteCategories() {
  const navigate = useNavigate();
  const [vote, setVote] = useState<string | null>(null);

  const handleVote = (categoryName: string) => {
    setVote(categoryName);
  };

  const handleNext = () => {
    navigate("/myvotes");
  };

  return (
    <div className="grid grid-flow-row-dense gap-y-4 place-content-center m-2">
      {CATEGORIES.map((category, index) => (
        <Button
          className="flex flex-row items-center gap-2 max-w-md m-2 space-x-1"
          key={index}
          style={{ backgroundColor: "#ff8932" }}
          onClick={() => handleVote(category.name)}
        >
          {category.icon}
          {category.name}
        </Button>
      ))}

      {vote ? (
        <div className="grid-flow-row gap-y-3">
          <Typography className="m-3" variant="h6">
            You have chosen: {vote}
          </Typography>
          {vote == "News/Info/Opinion" ? <VeracitySlider /> : null}
          <Button
            className="m-3"
            style={{ backgroundColor: "#00a8b1" }}
            onClick={() => handleNext()}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
