import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useNavigate, useLocation } from "react-router-dom";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const regex = /^\/messages\/[^/]+\/voteRequests\/[^/]+\/?$/;
  function onClick() {
    if (regex.test(location.pathname)) {
      const path = location.pathname
      console.log(location)
      console.log(location.state.status)
      const segments = path.split('/');
      const messageId = segments[2];
      console.log(messageId);
      navigate("/votes", {state: location.state});
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
