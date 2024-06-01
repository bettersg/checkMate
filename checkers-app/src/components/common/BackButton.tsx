import { Button } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useNavigate } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  return (
    <div className="fixed top-16 left-4 z-50 bg-gray-800 bg-opacity-75 p-2 rounded-full">
      <Button
        variant="text"
        className="rounded-full"
        style={{ color: "#ff8932" }}
        onClick={() => {
          navigate(`/votes`);
        }}
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Button>
    </div>
  );
}
