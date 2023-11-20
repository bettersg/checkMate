import LoadingPage from "./LoadingPage";
import VoteInstanceButton from "./VoteInstanceButton";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VoteInfoDialog from "./VoteInfo";
import { useUser } from '../../UserContext';
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
  Chip
} from "@material-tailwind/react";
import { Message } from "../../types";

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

  const { userId, messages, updateMessages } = useUser();
  // const [messages, setMessages] = useState<Message[]>([]);

  //set loading page before data is received from firebase
  const [loading, setLoading] = useState<boolean>(true);

  //message to be displayed when button is clicked
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [openPending, setPending] = useState<boolean>(true);
  const [openAssessed, setAssessed] = useState<boolean>(false);
  //for assessed msg info
  const [openDialog, setOpenDialog] = useState<boolean>(false);

  //go to voting page for pending msg
  const goVoting = (messageId: string) => {
    navigate(`/${messageId}/voting`);
  };

  //go to vote info for review/correct msg
  const handleOpenDialog = (message: Message) => {
    setSelectedMessage(message);
    setOpenDialog(!openDialog);
  };
  //displays vote instance buttons for each accordion
  const handlePending = () => setPending(!openPending);
  const handleAssessed = () => setAssessed(!openAssessed);

  const PENDING: Message[] = messages.filter((msg: Message) => !msg.isAssessed || msg.voteRequests.category == null);
  const ASSESSED: Message[] = messages.filter((msg: Message) => msg.isAssessed && msg.voteRequests.category != null);


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
          console.log("After fetch");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          updateMessages(data.messages);
          setLoading(false);

        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [userId]);

  //TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes
  return (
    <div>
      {loading ? (
        // Show loading state while messages are being fetched
        <LoadingPage />
      ) : (
        <>
          <Accordion open={openPending} icon={<Icon open={openPending} />}>
            <AccordionHeader onClick={handlePending} className={`transition-colors ${openPending ? "text-secondary-color2" : ""} justify-between`}>
              <div className="flex items-center gap-2">
                Pending
                <Chip value="1 unread" size="sm" className="rounded-full bg-primary-color" />
              </div>
            </AccordionHeader>
            <AccordionBody>
              {messages.length === 0 && <div className="text-primary-color">You have no pending messages</div>}
              {PENDING
                .sort((a, b) => {
                  // Sort by null category first (havent vote)
                  if (a.voteRequests.category === null && b.voteRequests.category !== null) {
                    return -1;
                  }
                  if (a.voteRequests.category !== null && b.voteRequests.category === null) {
                    return 1;
                  }
                  // If categories are the same or both are null, sort by firstTimestamp
                  return (a.firstTimestamp ? a.firstTimestamp.toMillis() : 0) - (b.firstTimestamp ? b.firstTimestamp.toMillis() : 0);
                })
                .map((msg) => (
                  <div>
                    <VoteInstanceButton
                      key={msg.id}
                      title={msg.text}
                      category={msg.voteRequests?.category || null}
                      isAssessed={msg.isAssessed}
                      isMatch={msg.isMatch}
                      primaryCategory={msg.primaryCategory}
                      isView={msg.isView}
                      handleClick={() => goVoting(msg.id)}
                      firstTimestamp={msg.firstTimestamp}
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
              {messages.length === 0 && <div>You have no messages</div>}
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
                    firstTimestamp={msg.firstTimestamp}
                  />
                </div>
              )
              )}
            </AccordionBody>
          </Accordion>

          {selectedMessage && openDialog && <VoteInfoDialog id={selectedMessage.id}
            text={selectedMessage.text}
            primaryCategory={selectedMessage.primaryCategory}
            category={selectedMessage.voteRequests?.category || null}
            handleOpen={() => setOpenDialog(!openDialog)}
            rationalisation={selectedMessage.rationalisation} />
          }
        </>
      )}
    </div>
  );
}
