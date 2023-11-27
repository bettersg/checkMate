import { XMarkIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { FaceFrownIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { BugAntIcon } from "@heroicons/react/20/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
import { HandThumbUpIcon } from "@heroicons/react/20/solid";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@material-tailwind/react";
import { useUser } from '../../UserContext';

import InfoOptions from "./Tier2";

interface PropType {
  msgId: string | undefined;
  voteCategory: string | null;
}

const CATEGORIES = [
  { name: "scam", icon: <XMarkIcon className="h-7 w-7" />, display: "Scam" },
  { name: "illicit", icon: <ShieldExclamationIcon className="h-7 w-7" />, display: "Illicit" },
  { name: "spam", icon: <FaceFrownIcon className="h-7 w-7" />, display: "Spam" },
  { name: "trivial", icon: <CheckCircleIcon className="h-7 w-7" />, display: "Trivial" },
  { name: "unsure", icon: <QuestionMarkCircleIcon className="h-7 w-7" />, display: "Unsure" },
  { name: "legitimate", icon: <HandThumbUpIcon className="h-7 w-7" />, display: "Legitimate" },
  { name: "info", icon: <LightBulbIcon className="h-7 w-7" />, display: "News/Info/Opinion" },
];

export default function VoteCategories(Prop: PropType) {
  const navigate = useNavigate();
  const initialVote = Prop.voteCategory != null ? Prop.voteCategory : null;
  const [vote, setVote] = useState<string | null>(initialVote);
  const { phoneNo, messages, updateMessages } = useUser();
  const [truthScoreOptions, showTruthScoreOptions] = useState<boolean>(false);
  const [truthScore, setTruthScore] = useState<number | null>(null);

  const handleSatireChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "yes") {
      showTruthScoreOptions(false);
      setVote("satire");
    }
    else {
      setVote("info");
      showTruthScoreOptions(true);
    }
  }

  const handleTruthScoreChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTruthScore(Number(event.target.value));
  }

  const handleVote = (categoryName: string) => {
    setVote(categoryName);
  };

  //function to update vote request in firebase
  const handleNext = (vote: string, msgId: string | undefined, truthScore: number | null) => {
    if (phoneNo && msgId) {
      const fetchData = async () => {
        try {
          const response = await fetch(`/api/checkers/${phoneNo}/messages/${msgId}/voteRequest`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ vote: vote, truthScore: truthScore }),
          });
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const data = await response.json();
          const updatedVoteRequests = data.voteRequest;

          // Update the specifc voteRequest in messages array
          const updatedMessages = messages.map(message => {
            if (message.id === msgId) {
              return { ...message, voteRequests: updatedVoteRequests };
            }
            return message;
          });
          // console.log("UPDATED: ", updateMessages);
          updateMessages(updatedMessages);

        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
    else {
      console.log("Error: phoneNo or msgId is null")
    }
    navigate(`/checkers/${phoneNo}/messages`);
  };

  return (
    <div className="grid grid-flow-row gap-y-4 items-center">
      {CATEGORIES.map((category, index) => (
        <Button
          className={`flex flex-row items-center justify-start gap-2 max-w-md space-x-3 text-sm
          ${vote === category.name ? 'bg-primary-color3' : 'bg-primary-color'}`}
          key={index}
          onClick={() => handleVote(category.name)}
        >
          {category.icon}
          {category.display}
        </Button>
      ))}

      {vote ? (
        <div className="place-self-center grid grid-flow-row gap-y-4 w-full">
          {vote == "info" ? <InfoOptions truthScoreOptions={truthScoreOptions} selectedTruthScore={truthScore} handleSatireChange={handleSatireChange} handleTruthScoreChange={handleTruthScoreChange} /> : null}
          {vote == "satire" ?
            <Button
              className={`flex flex-row items-center justify-start gap-2 max-w-md w-full space-x-3 text-sm
           ${vote === "satire" ? 'bg-primary-color3' : 'bg-primary-color'}`}
              onClick={() => handleVote("satire")}
            >
              <BugAntIcon className="h-7 w-7" />
              Satire
            </Button> : null}
          <Button
            className="bg-highlight-color w-fit place-self-center"
            onClick={() => handleNext(vote, Prop.msgId, truthScore)}
          >
            Done!
          </Button>
        </div>
      ) : null}
    </div>
  );
}
