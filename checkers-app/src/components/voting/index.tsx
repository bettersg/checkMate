import VoteCategories from "./VoteCategories";
import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "./BackButton";

export default function VotingPage() {
  return (
    <div className="grid grid-flow-row items-center gap-2">
      <BackButton />
      <MessageCard />
      <Typography variant="h4" className="text-primary-color3">Select category:</Typography>
      <VoteCategories />
    </div>
  );
}
