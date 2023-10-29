import VoteCategories from "./VoteCategories";
import MessageCard from "../../shared/MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "../../shared/BackButton";

const MESSAGE = {
  id: 1,
  text: "This is a message to be checked",
  isAssessed: false,
  primaryCategory: "",
}

export default function VotingPage() {
  return (
    <div className="grid grid-flow-row items-center gap-2">
      <BackButton />
      <MessageCard  id={MESSAGE.id} text={MESSAGE.text} />
      <Typography variant="h4" className="text-primary-color3">Select category:</Typography>
      <VoteCategories />
    </div>
  );
}
