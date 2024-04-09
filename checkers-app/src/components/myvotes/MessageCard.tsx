import { VoteSummary } from "../../types";
import { useNavigate } from "react-router-dom";
import { PencilIcon, QuestionMarkCircleIcon } from "@heroicons/react/20/solid";
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
    //category,
    //truthScore,
    type,
    createdTimestamp,
    //votedTimestamp,
    text,
    //caption,
    needsReview,
    isAssessed,
    isUnsure,
    firestorePath,
  } = props.voteSummary;
  const status = props.status;
  //   const colour: string = colours[category];
  const navigate = useNavigate();
  const dateString = dateToDateString(new Date(createdTimestamp));

  // If the message is PENDING, clicking the button should go to the voting page
  const viewVote = (firestorePath: string) => {
    navigate(`/${firestorePath}`);
  };

  const textStyle = "font-normal"; //add bold in future

  function renderStatusDot() {
    // Checking if the status is 'voted'
    if (status === "voted") {
      if (isAssessed) {
        if (isUnsure) {
          // Is unsure
          return (
            <div className="w-1/12 flex items-center justify-center">
              <QuestionMarkCircleIcon className="h-4 w-4" />
            </div>
          );
        } else {
          if (needsReview) {
            return (
              <div className="w-1/12 flex items-center justify-center">
                <div
                  className={`w-4 h-4 rounded-full bg-${colours.INCORRECT}`}
                ></div>
              </div>
            );
          } else {
            return (
              <div className="w-1/12 flex items-center justify-center">
                <div
                  className={`w-4 h-4 rounded-full bg-${colours.CORRECT}`}
                ></div>
              </div>
            );
          }
        }
      } else {
        // Not assessed
        return (
          <div className="w-1/12 flex items-center justify-center">
            <PencilIcon className="h-4 w-4" />
          </div>
        );
      }
    }
    // If none of the conditions match, return null
    return null;
  }

  return (
    <div
      className="flex border-b border-gray-500 h-16 hover-shadow dark:bg-dark-background-color"
      onClick={() => viewVote(firestorePath)}
    >
      {/* Coloured dot if needs review*/}

      {renderStatusDot()}

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
    </div>
  );
}
