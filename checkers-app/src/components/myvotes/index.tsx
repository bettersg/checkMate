import LoadingPage from "./LoadingPage";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import InformationButton from "./InformationButton";
import MessagesDisplay from "./MessagesDisplay";

// TODO: BRENNAN - Clean up
// interface IconProps {
//   open: boolean;
// }

// function Icon({ open }: IconProps) {
//   return (
//     <svg
//       xmlns="http://www.w3.org/2000/svg"
//       fill="none"
//       viewBox="0 0 24 24"
//       strokeWidth={2}
//       stroke="currentColor"
//       className={`${open ? "rotate-180" : ""} h-5 w-5 transition-transform`}
//     >
//       <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
//     </svg>
//   );
// }

export default function MyVotes() {
  const navigate = useNavigate();

  return (
    <div>
      <div>
        <MessagesDisplay />
      </div>
    </div>
  );
}
