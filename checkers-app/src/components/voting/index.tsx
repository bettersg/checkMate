import VoteCategories from "./VoteCategories";
import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "./BackButton";

export default function VotingPage() {
  return (
    <div className="flex-col items-center m-2 gap-y-4">
      <BackButton />
      <MessageCard />
      <Typography variant="h4">Select category:</Typography>
      <VoteCategories />
    </div>
  );
}
