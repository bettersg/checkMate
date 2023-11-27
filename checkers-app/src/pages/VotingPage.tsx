import Voting from "../components/voting";
import { useParams } from "react-router-dom";

export default function VotingPage (){
    const { msgId } = useParams();
    return <Voting msgId={msgId}/>;
}