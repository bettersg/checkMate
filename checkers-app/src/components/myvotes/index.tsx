import LoadingPage from "./LoadingPage";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import InformationButton from "./InformationButton";
import { useUser } from '../../UserContext';
import MessagesDisplay from "./MessagesDisplay";
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

  const { phoneNo, messages, updateMessages, updateUnchecked, pending, assessed, updateAssessed, unassessed, unchecked, updatePending, updateUnassessed } = useUser();

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
        const latestVoteReq = data.voteRequest;

        // Update the specifc voteRequest in messages array
        const latestMessages = messages.map(message => {
          if (message.id === msg.id) {
            return { ...message, voteRequests: latestVoteReq };
          }
          return message;
        });
        console.log("UPDATED: ", updateMessages);
        updateMessages(latestMessages);

        const PENDING: Message[] = latestMessages.filter((msg: Message) => !msg.isAssessed || msg.voteRequests.category == null);
        updatePending(PENDING);
        const pending_unread = PENDING.filter((msg: Message) => !msg.voteRequests.isView).length;
        updateUnassessed(pending_unread);

        const ASSESSED: Message[] = latestMessages.filter((msg: Message) => msg.isAssessed && msg.voteRequests.category != null);
        updateAssessed(ASSESSED);
        const assessed_unread = ASSESSED.filter((msg: Message) => !msg.voteRequests.isView).length;
        updateUnchecked(assessed_unread);

      } catch (error) {
        console.error("Error fetching vote result:", error);
      }
    }
  };

  //displays vote instance buttons for each accordion
  const handlePending = () => setPending(!openPending);
  const handleAssessed = () => setAssessed(!openAssessed);

  useEffect(() => {
    if (phoneNo && messages) {
      setLoading(false);
    }
  }, [phoneNo, messages]);

  return (
    <div>
      {loading ? (
        // Show loading state while messages are being fetched
        <LoadingPage />
      ) : (
        <div>
          <InformationButton />

          {/* ----------------- TO BE CHNAGED TO TABS ----------------- */}
          <MessagesDisplay/>
          {/* ----------------- OLD DESIGN ----------------- */}
          {/* <Accordion open={openPending} icon={<Icon open={openPending} />}
            className="mb-2 rounded-lg border border-secondary-color2 px-4">
            <AccordionHeader onClick={handlePending}
              className={`text-secondary-color2 ${openPending == false ? "border-b-0" : "border-secondary-color2"}`}
            // className={`transition-colors ${openPending ? "text-secondary-color2" : ""} justify-between`}
            >
              <div className="flex items-center gap-2">
                Pending
                {unassessed != 0 && <Chip value={`${unassessed} unread`} size="sm" className="rounded-full bg-primary-color" />}
              </div>
            </AccordionHeader>
            <AccordionBody>
              {pending.length === 0 && <div className="text-primary-color">You have no pending messages</div>}
              {pending.length !== 0 && pending
                .sort((a, b) => {
                  // Sort by null category first (havent vote)
                  if (a.voteRequests.category === null && b.voteRequests.category !== null) {
                    return -1;
                  }
                  if (a.voteRequests.category !== null && b.voteRequests.category === null) {
                    return 1;
                  }
                  // If categories are the same or both are null, sort by firstTimestamp
                  const aTimestamp = a.firstTimestamp && a.firstTimestamp.toMillis ? a.firstTimestamp.toMillis() : 0;
                  const bTimestamp = b.firstTimestamp && b.firstTimestamp.toMillis ? b.firstTimestamp.toMillis() : 0;
                  return aTimestamp - bTimestamp;
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
          <Accordion open={openAssessed} icon={<Icon open={openAssessed} />}
            className="mb-2 rounded-lg border border-primary-color2 px-4">
            <AccordionHeader onClick={handleAssessed}
              // className={`transition-colors ${openAssessed ? "text-primary-color2" : ""} justify-between`}
              className={`text-primary-color2 ${openAssessed == false ? "border-b-0" : "border-primary-color2"}`}>
              <div className="flex items-center gap-2">
                Assessed
                {unchecked != 0 && <Chip value={`${unchecked} unread`} size="sm" className="rounded-full bg-primary-color" />}
              </div>
            </AccordionHeader>
            <AccordionBody>
              {assessed.length === 0 && <div>You have no messages</div>}
              {assessed.length !== 0 && assessed
                .sort((a, b) => {
                  // Sort by checktimestamp first (haven't seen crowd vote)
                  if (a.voteRequests.checkTimestamp === null && b.voteRequests.checkTimestamp !== null) {
                    return -1;
                  }
                  if (a.voteRequests.checkTimestamp !== null && b.voteRequests.checkTimestamp === null) {
                    return 1;
                  }

                  // If categories are the same or both are null, sort by firstTimestamp
                  const aTimestamp = a.firstTimestamp && a.firstTimestamp.toMillis ? a.firstTimestamp.toMillis() : 0;
                  const bTimestamp = b.firstTimestamp && b.firstTimestamp.toMillis ? b.firstTimestamp.toMillis() : 0;
                  return aTimestamp - bTimestamp;
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
                      handleClick={() => handleOpenDialog(msg)}
                      firstTimestamp={msg.firstTimestamp}
                    />
                  </div>
                )
                )}
            </AccordionBody>
          </Accordion>

          {selectedMessage && openDialog &&

            <VoteInfoDialog id={selectedMessage.id}
              text={selectedMessage.text}
              primaryCategory={selectedMessage.primaryCategory}
              avgTruthScore={selectedMessage.avgTruthScore}
              category={selectedMessage.voteRequests?.category || null}
              truthScore={selectedMessage.voteRequests?.truthScore || null}
              handleClose={() => {
                setOpenDialog(!openDialog);
                navigate(`/checkers/${phoneNo}/messages`);
              }}
              rationalisation={selectedMessage.rationalisation}
              storageUrl={selectedMessage.storageUrl}
              caption={selectedMessage.caption}
              crowdPercentage={selectedMessage.crowdPercentage}
              votedPercentage={selectedMessage.votedPercentage}
            />

          } */}
        </div>
      )
      }
    </div>
  );
}

