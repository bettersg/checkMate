import VoteInstanceButton from "./VoteInstanceButton";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VoteInfoDialog } from "./VoteInfo";
import { useUser } from '../../UserContext';
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
  Chip
} from "@material-tailwind/react";
import { Timestamp } from "firebase/firestore";

interface VoteRequest {
  factCheckerDocRef: string;
  category: string | null;
  acceptedTimestamp: Timestamp | null;
  hasAgreed: boolean;
  vote: number | null;
  votedTimestamp: Timestamp | null;
}

interface Message {
  id: string;
  caption: string | null;
  text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequests: VoteRequest;
  justification: string;
  truthScore: number | null;
  isView: boolean //checks if checker has clicked in to view results/msg
}


interface IconProps {
  open: boolean;
}

function Icon({ open }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`${open ? "rotate-180" : ""} h-5 w-5 transition-transform`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export default function MyVotes() {
  const navigate = useNavigate();
  const { userId } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);

  //message to be displayed when button is clicked
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [openPending, setPending] = useState<boolean>(true);
  const [openAssessed, setAssessed] = useState<boolean>(false);
  //for assessed msg info
  const [openDialog, setOpenDialog] = useState<boolean>(false);

  //go to voting page for pending msg
  const goVoting = () => { navigate('/messageId/voting') };
  //go to vote info for review/correct msg
  const handleOpenDialog = (message: Message) => {
    setSelectedMessage(message);
    setOpenDialog(!openDialog);
  };
  //displays vote instance buttons for each accordion
  const handlePending = () => { setPending(!openPending) };
  const handleAssessed = () => setAssessed(!openAssessed);

  const PENDING: Message[] = messages.filter((msg: Message) => !msg.isAssessed || msg.primaryCategory == "");
  const ASSESSED: Message[] = messages.filter((msg: Message) => msg.isAssessed && msg.primaryCategory != "");


  useEffect(() => {
    //only calls api after authentication is done
    if (userId) {
      const fetchData = async () => {
        try {
          const response = await fetch("/api/getVotes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          setMessages(data.messages);
        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [userId]);
  //TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes
  //TODO: change the order of display of voting buttons in pending to be in order of voteRequest.category, isReplied, TimeStamp 
  return (
    <div>
      <Accordion open={openPending} icon={<Icon open={openPending} />}>
        <AccordionHeader onClick={handlePending} className={`transition-colors ${openPending ? "text-secondary-color2" : ""} justify-between`}>
          <div className="flex items-center gap-2">
            Pending
            <Chip value="1 unread" size="sm" className="rounded-full bg-primary-color" />
          </div>
        </AccordionHeader>
        <AccordionBody>
          {PENDING.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.id}
                title={msg.text}
                category={msg.voteRequests?.category || null}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                primaryCategory={msg.primaryCategory}
                isView={msg.isView}
                handleClick={goVoting}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
      <Accordion open={openAssessed} icon={<Icon open={openAssessed} />}>
        <AccordionHeader onClick={handleAssessed} className={`transition-colors ${openAssessed ? "text-primary-color2" : ""} justify-between`}>
          <div className="flex items-center gap-2">
            Assessed
            <Chip value="2 unread" size="sm" className="rounded-full bg-primary-color" />
          </div>
        </AccordionHeader>
        <AccordionBody>
          {ASSESSED.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.id}
                title={msg.text}
                category={msg.voteRequests?.category || null}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                primaryCategory={msg.primaryCategory}
                isView={msg.isView}
                handleClick={() => handleOpenDialog(msg)}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>

      {selectedMessage && <VoteInfoDialog id={selectedMessage.id}
        text={selectedMessage.text}
        primaryCategory={selectedMessage.primaryCategory}
        category={selectedMessage.voteRequests?.category || null}
        open={openDialog}
        handleOpen={() => setOpenDialog(!openDialog)}
        justification={selectedMessage.justification} />
      }
    </div>
  );
}
