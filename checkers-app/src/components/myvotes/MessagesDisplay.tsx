/* 
Component to categorise and display the messages.

Includes a "PENDING" and "VOTED" tab depending on the status of the message.

Subcategories of the messages include:
- Urgent (PENDING)
- Expired (PENDING)
- Awaiting results (VOTED)
- Correctly voted (VOTED)
- Incorrectly voted (VOTED)

Idea:
- Get the messages from the UserContext
- Filter messages based on the status of the message
- Have a nested component for each button
*/

import { useState } from "react";
import { useUser } from '../../providers/UserContext';
import MessageCard from "./MessageCard";
import { useNavigate } from "react-router-dom";

export default function MessagesDisplay() {
    const navigate = useNavigate();

    // Get the messages from the UserContext
    const { phoneNo, messages, updateMessages, updateUnchecked, pending, assessed, updateAssessed, unassessed, unchecked, updatePending, updateUnassessed } = useUser();

    const [activeTab, setActiveTab] = useState<string>("PENDING");

    const goVoting = (messageId: string) => {
        navigate(`/checkers/${phoneNo}/messages/${messageId}/voteRequest`);
    };
    // TODO: BRENNAN - Clean up
    console.log(goVoting)
    console.log(messages, updateMessages, updateUnchecked, updateAssessed, unassessed, unchecked, updatePending, updateUnassessed)


    return (
        <div>
            {/* 2 buttons ('PENDING' and 'VOTING') that act as tabs. */}
            <div className="flex justify-around relative border-b-2 border-primary-color2" style={{ boxShadow: '0 7px 9px -7px rgba(0,0,0,0.7)' }}>
                <button
                    className={`w-1/2 text-center py-2 ${activeTab === "PENDING" ? "border-b-4 border-primary-color2 text-primary-color2" : "text-black"} font-bold`}
                    onClick={() => setActiveTab("PENDING")}>
                    PENDING
                </button>
                <button
                    className={`w-1/2 text-center py-2 ${activeTab === "VOTED" ? "border-b-4 border-primary-color2 text-primary-color2" : "text-black"} font-bold`}
                    onClick={() => setActiveTab("VOTED")}>
                    VOTED
                </button>
            </div>
            {/* Display the messages based on the active tab
            NOTE: Height is hardcoded, to be changed */}
            <div className="overflow-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>
                    {`
                    ::-webkit-scrollbar {
                        display: none;
                    }
                    `}
                </style>
                {pending.length === 0 && activeTab === "PENDING" && <div className="text-primary-color">You have no pending messages</div>}
                {pending.length !== 0 && activeTab === "PENDING" && pending
                    .map((msg) => (
                        <div>
                            <MessageCard message={msg} />
                        </div>
                    )
                    )}
                {assessed.length === 0 && activeTab === "VOTED" && <div>You have no messages</div>}
                {assessed.length !== 0 && activeTab === "VOTED" && assessed
                    .map((msg) => (
                        <div>
                            <MessageCard message={msg} />
                        </div>
                    )
                    )}
            </div>
        </div>
    )
}