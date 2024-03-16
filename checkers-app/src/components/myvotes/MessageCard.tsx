import { VoteSummary } from "../../types";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import VoteInfoDialog from "./VoteInfo";
import "./MessageCard.css";

interface MessageCardProps {
  voteSummary: VoteSummary;
  status: string;
}

type ColourMap = {
  [key: string]: string;
};

const colours: ColourMap = {
  PENDING: "secondary-color",
  CORRECT: "success-color",
  INCORRECT: "error-color",
  HIGHLIGHT: "highlight-color",
  DEFAULT: "primary-color",
  WAITING: "waiting-color",
};

// function getCategory(msg: Message): string {
//     if (msg.voteRequests.category == null) {
//         return "PENDING";
//     }
//     else if (!msg.isAssessed && msg.voteRequests.category != null) {
//         return "WAITING";
//     }
//     else {
//         if (msg.isMatch) {
//             return "CORRECT"
//         }
//         else {
//             return "INCORRECT"
//         }
//     }
// }

function dateToDateString(date: Date | null): string {
  // Parse the ISO string into a Date object
  if (date === null) {
    return "No date";
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // Extract the day, month, and year from the Date object
  const day = date.getDate();
  const month = months[date.getUTCMonth()]; // Get month name from array
  const year = date.getFullYear();

  // Format the day and month to ensure they are in two digits, and get the last two digits of the year
  const formattedDay = day.toString().padStart(2, "0");
  const formattedYear = year.toString().substring(2);

  // Combine parts into the final DD-MM-YY format
  const formattedDate = `${formattedDay}-${month}-${formattedYear}`;

  // Return the formatted date
  return formattedDate;
}

export default function MessageCard(props: MessageCardProps) {
  const {
    category,
    truthScore,
    type,
    createdTimestamp,
    votedTimestamp,
    text,
    caption,
    needsReview,
    isAssessed,
    firestorePath,
  } = props.voteSummary;
  const status = props.status;
  //   const colour: string = colours[category];
  const navigate = useNavigate();
  const dateString = dateToDateString(new Date(createdTimestamp));
  const [openMsgInfo, setOpenMsgInfo] = useState<boolean>(false);

  // If the message is PENDING, clicking the button should go to the voting page
  const viewVote = (firestorePath: string) => {
    navigate(`/${firestorePath}`);
  };

  //   const handleOpenMsgInfo = async () => {
  //     setOpenMsgInfo(!openMsgInfo);

  //     if (msg && !msg.voteRequests.isView) {
  //       try {
  //         const response = await fetch(
  //           `/api/checkers/${phoneNo}/messages/${msg.id}/voteResult`,
  //           {
  //             method: "PATCH",
  //           }
  //         );
  //         console.log("After fetch");
  //         if (!response.ok) {
  //           throw new Error(`HTTP error! Status: ${response.status}`);
  //         }
  //         const data = await response.json();
  //         const latestVoteReq = data.voteRequest;

  //         // Update the specifc voteRequest in messages array
  //         const latestMessages = messages.map((message) => {
  //           if (message.id === msg.id) {
  //             return { ...message, voteRequests: latestVoteReq };
  //           }
  //           return message;
  //         });
  //         console.log("UPDATED: ", updateMessages);
  //         updateMessages(latestMessages);

  //         const PENDING: Message[] = latestMessages.filter(
  //           (msg: Message) => !msg.isAssessed || msg.voteRequests.category == null
  //         );
  //         updatePending(PENDING);
  //         const pending_unread = PENDING.filter(
  //           (msg: Message) => !msg.voteRequests.isView
  //         ).length;
  //         updateUnassessed(pending_unread);

  //         const ASSESSED: Message[] = latestMessages.filter(
  //           (msg: Message) => msg.isAssessed && msg.voteRequests.category != null
  //         );
  //         updateAssessed(ASSESSED);
  //         const assessed_unread = ASSESSED.filter(
  //           (msg: Message) => !msg.voteRequests.isView
  //         ).length;
  //         updateUnchecked(assessed_unread);
  //       } catch (error) {
  //         console.error("Error fetching vote result:", error);
  //       }
  //     }
  //   };

  const textStyle = "font-normal"; //add bold in future

  return (
    <div
      className="flex border-b border-gray-500 h-16 hover-shadow"
      onClick={() => viewVote(firestorePath)}
    >
      {/* Coloured dot if needs review*/}

      {isAssessed && needsReview && status === "voted" && (
        <div className="w-1/12 flex items-center justify-center">
          <div className={`w-4 h-4 rounded-full bg-${colours.INCORRECT}`}></div>
        </div>
      )}

      {/* Message content */}
      <div className="w-11/12 p-2">
        <p className="font-bold">{dateString}</p>
        <div
          className={`truncate inline-block overflow-hidden ${textStyle}`}
          style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}
        >
          {type === "text" ? text : "Image"}
        </div>
      </div>
      {/* {openMsgInfo && (
        <VoteInfoDialog
          id={msg.id}
          text={msg.text}
          primaryCategory={msg.primaryCategory}
          avgTruthScore={msg.avgTruthScore}
          category={msg.voteRequests?.category || null}
          truthScore={msg.voteRequests?.truthScore || null}
          handleClose={() => {
            setOpenMsgInfo(!openMsgInfo);
          }}
          rationalisation={msg.rationalisation}
          storageUrl={msg.storageUrl}
          caption={msg.caption}
          crowdPercentage={msg.crowdPercentage}
          votedPercentage={msg.votedPercentage}
        />
      )} */}
    </div>
  );
}
