import { Button } from "@material-tailwind/react";

export default function VoteInstanceButton() {
  return (
    <div className="flex items-center gap-4 m-2">
      <Button className="rounded-full" color="yellow" style={{ width: "100%" }}>
        Pending
      </Button>
    </div>
  );
}
