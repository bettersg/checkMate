import VoteInstanceButton from "./VoteInstanceButton";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import VoteDrawer from "./VoteDrawer";
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
  Id: number;
  title: string;
  Text: string;
  isAssessed: boolean;
  isMatch: boolean;
  primaryCategory: string;
  voteRequest: VoteRequest;
}

//should be arranged by date (most recent first)
const MESSAGES: Message[] = [
  {
    Id: 1, Text: "This is a message to be checked", title:"Police warn against fake online articles of PM Lee endorsing investment in cryptocurrencies.",isAssessed: false, isMatch: false, primaryCategory: "",
    voteRequest: { userid: 2, category: "" }
  },
  {
    Id: 2, Text: "This is a message already assessed", title:"HDB letter with QR code for motorists to scan, pay parking fees - Is it a scam?", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "News/Info/Opinion" }
  },
  {
    Id: 3, Text: "This is a message already assessed", title:"SingPost to hike rate for standard regular mail from Oct 9 to meet rising costs", isAssessed: true, isMatch: true, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Scam" }
  },
  {
    Id: 4, Text: "This is a message already assessed", title:"$1.4 trillion lost to scams globally, Singapore has lost the most on average.", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Illicit" }
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
  const goVoting = () => { navigate('/messageId/voting') };

  const [openPending, setPending] = useState<boolean>(true);
  const [openNoMatch, setNoMatch] = useState<boolean>(false);
  const [openMatch, setMatch] = useState<boolean>(false)

  const handlePending = () => setPending((cur) => !cur);
  const handleNoMatch = () => setNoMatch((cur) => !cur);
  const handleMatch = () => setMatch((cur) => !cur);

  const PENDING:Message[] = MESSAGES.filter(msg => !msg.isAssessed);
  const MATCH:Message[] = MESSAGES.filter(msg => msg.isAssessed && msg.isMatch);
  const NO_MATCH:Message[] = MESSAGES.filter(msg => msg.isAssessed && !msg.isMatch);

  //TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes
  return (
    <div>
      <Accordion open={openPending} icon={<Icon open={openPending} />}>
        <AccordionHeader onClick={handlePending} className={`transition-colors ${openPending ? "text-secondary-color2":""}`}>Pending</AccordionHeader>
        <AccordionBody>
          {PENDING.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.Id}
                Id={msg.Id}
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
        <AccordionHeader onClick={handleNoMatch} className={`transition-colors ${openNoMatch ? "text-primary-color2":""}`}>Review</AccordionHeader>
        <AccordionBody>
          {NO_MATCH.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.Id}
                Id={msg.Id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={goVoting}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
      <Accordion open={openMatch} icon={<Icon open={openMatch} />}>
        <AccordionHeader onClick={handleMatch} className={`transition-colors ${openMatch ? "text-green-600":""}`}>Correct</AccordionHeader>
        <AccordionBody>
          {MATCH.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.Id}
                Id={msg.Id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={goVoting}
              />
            </div>
          )
          )}
        </AccordionBody>
      </Accordion>
    </div>
  );
}
