import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useNavigate, useLocation } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const regex = /^\/messages\/[^/]+\/voteRequests\/[^/]+\/?$/;
  function onClick() {
    if (regex.test(location.pathname)) {
      navigate("/votes");
    } else {
      navigate(-1);
    }
  }

  return (
    <ArrowLeftIcon
      className="h-6 w-6 text-[#ff8932] cursor-pointer"
      onClick={onClick}
    />
  );
}
