import { Alert } from "@material-tailwind/react";
import { EnvelopeIcon } from "@heroicons/react/20/solid";
import { BellAlertIcon } from "@heroicons/react/20/solid";
import { useNavigate } from "react-router-dom";

//true for pending messages, false for update on pending VOTE
export default function PendingMessageAlert({
  hasPending,
  pendingCount,
}: {
  hasPending: boolean;
  pendingCount: number;
}) {
  const navigate = useNavigate();

  const handleAlertClick = () => {
    navigate("/votes");
  };

  return (
    <div onClick={handleAlertClick} className="cursor-pointer">
      <Alert
        icon={
          hasPending ? (
            <EnvelopeIcon className="h-6 w-6 text-highlight-color" />
          ) : (
            <BellAlertIcon className="h-6 w-6 text-highlight-color" />
          )
        }
        className="rounded items-center border-l-4 border-highlight-color bg-[highlight-color]/5 font-medium text-highlight-color shadow-md"
      >
        {hasPending
          ? `${pendingCount} pending message(s) yet to vote!`
          : `${"TBD"} Crowd Vote updates!`}
      </Alert>
    </div>
  );
}
