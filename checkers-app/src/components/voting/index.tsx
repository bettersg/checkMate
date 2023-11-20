import VoteCategories from "./VoteCategories";
import MessageCard from "../../shared/MessageCard";
import { Typography } from "@material-tailwind/react";
import { BackButton } from "../../shared/BackButton";
import { useEffect, useState } from "react";
import { useUser } from '../../UserContext';
import { Message } from "../../types";

interface PropType {
  msgId: string | undefined
}

//TODO: link slider values for truthscore and triggerL2Vote field
export default function VotingPage(Prop: PropType) {
  const { userId, messages } = useUser();
  const [msg, setMsg] = useState<Message | null>(null);

  useEffect(() => {
    //only calls api after authentication is done
    if (userId && Prop.msgId) {
      // Find the message in the messages array with matching id
      const foundMessage = messages.find((message) => message.id === Prop.msgId);
      // If a matching message is found, set it as the msg state
      if (foundMessage) {
        setMsg(foundMessage);
      } else {
        console.error(`Message with id ${Prop.msgId} not found in the messages array.`);
      }
    }
    if (msg && !msg.isView) {
      const fetchData = async () => {
        try {
          const response = await fetch("/api/updateView", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, msgId: msg.id }),
          });
          console.log("After fetch");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          
        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [userId, msg, Prop.msgId, messages]);



  return (
    <>
      {!msg
        ? null
        :
        <div className="grid grid-flow-row items-center gap-2 pb-2">
          < BackButton />
          <MessageCard text={msg.text} />
          <Typography variant="h4" className="text-primary-color3">Select category:</Typography>
          <VoteCategories msgId={Prop.msgId} voteCategory={msg.voteRequests.category} />
        </div >
      }
    </>
  );
}
