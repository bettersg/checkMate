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
  const { userId } = useUser();
  const [msg, setMsg] = useState<Message | null>(null);
  useEffect(() => {
    //only calls api after authentication is done
    if (userId && Prop.msgId) {
      const fetchData = async () => {
        try {
          const response = await fetch("/api/getVoteRequest", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, msgId: Prop.msgId }),
          });
          console.log("After fetch");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          setMsg(data.message);
          // setLoading(false);

        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [userId, Prop.msgId]);

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
