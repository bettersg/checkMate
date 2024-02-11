import { Button } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../providers/UserContext";

export function BackButton() {
  const { phoneNo } = useUser();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-4">
      <Button
        variant="text"
        className="rounded-full absolute left-1 top-0"
        style={{ color: "#ff8932" }}
        onClick={() => {
          navigate(`/checkers/${phoneNo}/messages`);
        }}
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}
