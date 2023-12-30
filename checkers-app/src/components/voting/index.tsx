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
  const { phoneNo, messages } = useUser();
  const [msg, setMsg] = useState<Message | null>(null);

  useEffect(() => {
    //only calls api after authentication is done
    if (phoneNo && Prop.msgId) {
      // Find the message in the messages array with matching id
      const foundMessage = messages.find((message) => message.id === Prop.msgId);
      // If a matching message is found, set it as the msg state
      if (foundMessage) {
        setMsg(foundMessage);
      } else {
        console.error(`Message with id ${Prop.msgId} not found in the messages array.`);
      }
    }
  }, [phoneNo, msg, Prop.msgId, messages]);

  return (
    <>
      {!msg
        ? null
        :
        <div className="grid grid-flow-row items-center gap-2 pb-2 left-right-padding">
          < BackButton />
          <MessageCard text={msg.text} imageUrl={null} caption={msg.caption} />
          <Typography variant="h4" className="text-primary-color3">Select category:</Typography>
          <VoteCategories msgId={Prop.msgId} voteCategory={msg.voteRequests.category} truthScore={msg.voteRequests.truthScore}/>
        </div >
      }
    </>
  );
}
