import { Message } from "../../types";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../UserContext";
import { useState, useEffect } from "react";
import VoteInfoDialog from "./VoteInfo";
import "./MessageCard.css";

interface MessageCardProps {
    message: Message;
}

type ColourMap = {
    [key: string]: string;
}

const colours: ColourMap = {
    "PENDING": "secondary-color",
    "CORRECT": "success-color",
    "INCORRECT": "error-color",
    "HIGHLIGHT": "highlight-color",
    "DEFAULT": "primary-color",
};

function getCategory(msg: Message): string {
    if (!msg.isAssessed || msg.voteRequests.category == null) {
        return "PENDING";
    } else {
        if (msg.isMatch) {
            return "CORRECT"
        }
        else {
            return "INCORRECT"
        }
    }
}

function ISOStringToDateString(isoString: string | null): string {
    // Parse the ISO string into a Date object
    if (isoString === null) {
        return "No date";
    }
    const date = new Date(isoString);

    // Extract the day, month, and year from the Date object
    const day = date.getDate();
    const month = date.getMonth() + 1; // Month is 0-indexed, add 1 for the correct month
    const year = date.getFullYear();

    // Format the day and month to ensure they are in two digits, and get the last two digits of the year
    const formattedDay = day.toString().padStart(2, '0');
    const formattedMonth = month.toString().padStart(2, '0');
    const formattedYear = year.toString().substring(2);

    // Combine parts into the final DD-MM-YY format
    const formattedDate = `${formattedDay}-${formattedMonth}-${formattedYear}`;

    // Return the formatted date
    return formattedDate;
}


export default function MessageCard(props: MessageCardProps) {
    const msg = props.message;
    const {phoneNo } = useUser();
    const category: string = getCategory(msg);
    const colour: string = colours[category];
    const navigate = useNavigate();
    let dateString = ISOStringToDateString(msg.firstTimestamp);
    const [openMsgInfo, setOpenMsgInfo] = useState<boolean>(false);

    // If the message is PENDING, clicking the button should go to the voting page
    const goVoting = (messageId: string) => {
        navigate(`/checkers/${phoneNo}/messages/${messageId}/voteRequest`);
    };

    const handleOpenMsgInfo = () => {
        setOpenMsgInfo(!openMsgInfo);
    }



    return (
        <div 
            className="flex border-b border-gray-500 h-16 hover-shadow" 
            onClick={category==="PENDING" ? ()=>goVoting(msg.id) : ()=>{handleOpenMsgInfo()}}>

            {/* Coloured dot */}
            <div className="w-1/12 flex items-center justify-center">
                <div 
                    className={`w-4 h-4 rounded-full bg-${colour}`}
                ></div>
            </div>

            {/* Message content */}
            <div className="w-11/12 p-2" >
                <p className="font-bold">{dateString}</p>
                <div 
                    className="truncate inline-block overflow-hidden"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}>
                        {msg.text}
                </div>
            </div>
            {openMsgInfo && 
            <VoteInfoDialog id={msg.id}
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
        }
        </div>
    );
}
