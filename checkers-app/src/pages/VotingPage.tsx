import Voting from "../components/voting";
import { useParams } from "react-router-dom";

export default function VotingPage (){
    const { messageId } = useParams();
    return <Voting msgId={messageId}/>;
}