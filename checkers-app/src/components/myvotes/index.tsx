import VoteInstanceButton from "./VoteInstanceButton";
import { useState} from "react";
import { useNavigate } from "react-router-dom";
import { VoteInfoDialog } from "./VoteInfo";
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
} from "@material-tailwind/react";

interface VoteRequest {
  userid: number;
  category: string;
}

interface Message {
  id: number;
  title: string;
  text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequest: VoteRequest;
  justification: string
}

//should be arranged by date (most recent first)
const MESSAGES: Message[] = [
  {
    id: 1, text: "This is a message to be checked", title: "Police warn against fake online articles of PM Lee endorsing investment in cryptocurrencies.", isAssessed: false, isMatch: false, primaryCategory: "",
    voteRequest: { userid: 2, category: "" }, justification:""
  },
  {
    id: 2, text: "This is a message already assessed", title: "HDB letter with QR code for motorists to scan, pay parking fees - Is it a scam?", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "News/Info/Opinion" }, justification:"ChatGPT is figuring out"
  },
  {
    id: 3, text: "This is a message already assessed", title: "SingPost to hike rate for standard regular mail from Oct 9 to meet rising costs", isAssessed: true, isMatch: true, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Scam" }, justification:"ChatGPT is figuring out"
  },
  {
    id: 4, text: "This is a message already assessed", title: "$1.4 trillion lost to scams globally, Singapore has lost the most on average.", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Illicit" }, justification:"ChatGPT is figuring out"
  },
]

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
  
  //message to be displayed when button is clicked
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [openPending, setPending] = useState<boolean>(true);
  const [openNoMatch, setNoMatch] = useState<boolean>(false);
  const [openMatch, setMatch] = useState<boolean>(false)
  const [openDialog, setOpenDialog] = useState<boolean>(false);

  //go to voting page for pending msg
  const goVoting = () => { navigate('/messageId/voting') };
  //go to vote info for review/correct msg
  const handleOpenDialog = (message: Message) => {
    setSelectedMessage(message); 
    setOpenDialog(!openDialog);
  };
  //displays vote instance buttons for each accordion
  const handlePending = () => {setPending(!openPending)};
  const handleNoMatch = () => setNoMatch(!openNoMatch);
  const handleMatch = () => setMatch(!openMatch);

  const PENDING: Message[] = MESSAGES.filter(msg => !msg.isAssessed);
  const MATCH: Message[] = MESSAGES.filter(msg => msg.isAssessed && msg.isMatch);
  const NO_MATCH: Message[] = MESSAGES.filter(msg => msg.isAssessed && !msg.isMatch);

  //TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes
  return (
    <div>
      <Accordion open={openPending} icon={<Icon open={openPending} />}>
        <AccordionHeader onClick={handlePending} className={`transition-colors ${openPending ? "text-secondary-color2" : ""}`}>Pending</AccordionHeader>
        <AccordionBody>
          {PENDING.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.id}
                id={msg.id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={goVoting}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
      <Accordion open={openNoMatch} icon={<Icon open={openNoMatch} />}>
        <AccordionHeader onClick={handleNoMatch} className={`transition-colors ${openNoMatch ? "text-primary-color2" : ""}`}>Review</AccordionHeader>
        <AccordionBody>
          {NO_MATCH.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.id}
                id={msg.id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={()=>handleOpenDialog(msg)}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
      <Accordion open={openMatch} icon={<Icon open={openMatch} />}>
        <AccordionHeader onClick={handleMatch} className={`transition-colors ${openMatch ? "text-green-600" : ""}`}>Correct</AccordionHeader>
        <AccordionBody>
          {MATCH.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.id}
                id={msg.id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={()=>handleOpenDialog(msg)}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
      {selectedMessage && <VoteInfoDialog id={selectedMessage.id}
        text={selectedMessage.text}
        primaryCategory={selectedMessage.primaryCategory}
        voteRequest={selectedMessage.voteRequest}
        open = {openDialog}
        handleOpen = {()=>setOpenDialog(!openDialog)}
        justification ={selectedMessage.justification}/>
      }
    </div>
  );
}
