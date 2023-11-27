import LoadingPage from "./LoadingPage";
import VoteInstanceButton from "./VoteInstanceButton";
import { useState, useEffect, useMemo } from "react";
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

  const { userId, phoneNo, messages, updateMessages, updateUnassessed, updateUnchecked, pending, assessed, updateAssessed, updatePending, unassessed, unchecked } = useUser();

  //set loading page before data is received from firebase
  const [loading, setLoading] = useState<boolean>(false);

  //message to be displayed when button is clicked
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [openPending, setPending] = useState<boolean>(true);
  const [openAssessed, setAssessed] = useState<boolean>(false);
  //for assessed msg info
  const [openDialog, setOpenDialog] = useState<boolean>(false);

  //go to voting page for pending msg
  const goVoting = (messageId: string) => {
    navigate(`/checkers/${phoneNo}/messages/${messageId}/voteRequest`);
  };

  //open vote info dialog for assessed msgs
  const handleOpenDialog = async (msg: Message) => {
    setSelectedMessage(msg);
    setOpenDialog(!openDialog);

    if (msg && !msg.voteRequests.isView) {
      try {
        const response = await fetch(`/api/checkers/${phoneNo}/messages/${msg.id}/voteResult`, {
          method: "PATCH",
        });
        console.log("After fetch");
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const updatedVoteRequests = data.voteRequest;

        // Update the specifc voteRequest in messages array
        const updatedMessages = messages.map(message => {
          if (message.id === msg.id) {
            return { ...message, voteRequests: updatedVoteRequests };
          }
          return message;
        });
        console.log("UPDATED: ", updateMessages);
        updateMessages(updatedMessages);


      } catch (error) {
        console.error("Error fetching vote result:", error);
      }
    }
  };

  //displays vote instance buttons for each accordion
  const handlePending = () => setPending(!openPending);
  const handleAssessed = () => setAssessed(!openAssessed);

  // Memoize the messages array
  const memoizedMessages = useMemo(() => messages, [messages]);

  // Memoize the filtered pending messages
  const memoizedPending = useMemo(() => {
    return messages.filter((msg) => !msg.isAssessed || msg.voteRequests.category == null);
  }, [messages]);

  // Memoize the filtered assessed messages
  const memoizedAssessed = useMemo(() => {
    return messages.filter((msg) => msg.isAssessed && msg.voteRequests.category != null);
  }, [messages]);

  useEffect(() => {
    //only calls api after authentication is done
    console.log(`Fetching votes for ${phoneNo}`);
    if (phoneNo) {
      const fetchData = async () => {
        try {
          const response = await fetch(`/api/checkers/${phoneNo}/messages`, {
            method: "GET",
          });
          console.log("After fetch");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          // Check if the messages array has changed
          if (!arraysEqual(memoizedMessages, data.messages)) {
            // Update messages in the context
            updateMessages(data.messages);
          }
          updateMessages(data.messages);

          const PENDING: Message[] = data.messages.filter((msg: Message) => !msg.isAssessed || msg.voteRequests.category == null);
          const ASSESSED: Message[] = data.messages.filter((msg: Message) => msg.isAssessed && msg.voteRequests.category != null);

          updatePending(PENDING);
          updateAssessed(ASSESSED);

          const pending_unread = PENDING.filter((msg: Message) => !msg.voteRequests.isView).length;
          updateUnassessed(pending_unread);
          //calculate assessed unread
          const assessed_unread = ASSESSED.filter((msg: Message) => !msg.voteRequests.isView).length;
          updateUnchecked(assessed_unread);

          setLoading(false);
        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [phoneNo, updateMessages, messages, updatePending, updateAssessed, updateUnchecked, updateUnassessed, memoizedMessages]);


  // const PENDING: Message[] = messages.filter((msg: Message) => !msg.isAssessed || msg.voteRequests.category == null);
  // const ASSESSED: Message[] = messages.filter((msg: Message) => msg.isAssessed && msg.voteRequests.category != null);
  //calculate pending unread



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
                {unassessed != 0 && <Chip value={`${unassessed} unread`} size="sm" className="rounded-full bg-primary-color" />}
              </div>
            </AccordionHeader>
            <AccordionBody>
              {memoizedPending.length === 0 && <div className="text-primary-color">You have no pending messages</div>}
              {memoizedPending.length !== 0 && memoizedPending
                .sort((a, b) => {
                  // Sort by null category first (havent vote)
                  if (a.voteRequests.category === null && b.voteRequests.category !== null) {
                    return -1;
                  }
                  if (a.voteRequests.category !== null && b.voteRequests.category === null) {
                    return 1;
                  }
                  // If categories are the same or both are null, sort by firstTimestamp
                  console.log("a.firstTimestamp:", a.firstTimestamp);
                  console.log("b.firstTimestamp:", b.firstTimestamp);
                  return (
                    (a.firstTimestamp ? a.firstTimestamp.toDate()?.getTime() : 0) -
                    (b.firstTimestamp ? b.firstTimestamp.toDate()?.getTime() : 0)
                  );
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
                      isView={msg.voteRequests.isView}
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
                {unchecked != 0 && <Chip value={`${unchecked} unread`} size="sm" className="rounded-full bg-primary-color" />}
              </div>
            </AccordionHeader>
            <AccordionBody>
              {memoizedAssessed.length === 0 && <div>You have no messages</div>}
              {memoizedAssessed.length !== 0 && memoizedAssessed
                // .sort((a, b) => {
                //   // Sort by checktimestamp first (havent see crowd vote)
                //   if (a.voteRequests.checkTimestamp === null && b.voteRequests.checkTimestamp !== null) {
                //     return -1;
                //   }
                //   if (a.voteRequests.checkTimestamp !== null && b.voteRequests.checkTimestamp === null) {
                //     return 1;
                //   }
                //   // If categories are the same or both are null, sort by firstTimestamp
                //   console.log("a.firstTimestamp:", a.firstTimestamp);
                //   console.log("b.firstTimestamp:", b.firstTimestamp);
                //   return (
                //     (a.firstTimestamp ? a.firstTimestamp?.toDate()?.getTime() : 0) -
                //     (b.firstTimestamp ? b.firstTimestamp?.toDate()?.getTime() : 0)
                //   );
                // })
                .map((msg) => (
                  <div>
                    <VoteInstanceButton
                      key={msg.id}
                      title={msg.text}
                      category={msg.voteRequests?.category || null}
                      isAssessed={msg.isAssessed}
                      isMatch={msg.isMatch}
                      primaryCategory={msg.primaryCategory}
                      isView={msg.voteRequests.isView}
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
            handleClose={() => {
              setOpenDialog(!openDialog);
              navigate(`/checkers/${phoneNo}/messages`);
            }}
            rationalisation={selectedMessage.rationalisation}
            // imageUrl={selectedMessage.imageUrl}
            caption={null}
            // imageUrl = "https://images.unsplash.com/photo-1629367494173-c78a56567877?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=927&q=80"
            // imageUrl = "/sample.jpg"
            imageUrl="/sample2.jpg"
          />
          }
        </>
      )}
    </div>
  );
}


// Helper function to check if two arrays are equal
function arraysEqual(a: Message[], b: Message[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}