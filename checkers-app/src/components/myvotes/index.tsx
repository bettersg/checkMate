import NavbarDefault from "../../shared/BotNavBar";
import Header from "../../shared/Header";
import PageHeader from "../../shared/PageHeader";
import VoteInstanceButton from "./VoteInstanceButton";
import FilterVoteButton from "./FilterVotes";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import VoteDrawer from "./VoteDrawer";

//should be arranged by date (most recent first)
const MESSAGES = [
  {
    Id: 1, Text: "This is a message to be checked", isAssessed: false, isMatch: false, primaryCategory: "",
    voteRequest: { userid: 2, category: "" }
  },
  {
    Id: 2, Text: "This is a message already assessed", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "News/Info/Opinion" }
  },
  {
    Id: 3, Text: "This is a message already assessed", isAssessed: true, isMatch: true, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Scam" }
  },
  {
    Id: 4, Text: "This is a message already assessed", isAssessed: true, isMatch: false, primaryCategory: "Scam",
    voteRequest: { userid: 2, category: "Illicit" }
  },
]

export default function MyVotes() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const openDrawerBottom = msgId => {
    setOpenDrawer(true);
    setSelectedMsg(MESSAGES[msgId - 1]);
  }
  const closeDrawerBottom = () => setOpenDrawer(false);
  const navigate = useNavigate();
  const goVoting = () => { navigate('/messageId/voting') };

  //TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes
  return (
    <div style={{}}>
      <Header>Samantha</Header>
      <PageHeader>MY VOTES</PageHeader>
      <div className="grid grid-col-4 grid-flow-col gap-2">
        <div className="grid-flow-row col-span-3">
          {MESSAGES.map((msg) => (
            <div>
              <VoteInstanceButton
                key={msg.Id}
                Id={msg.Id}
                isAssessed={msg.isAssessed}
                isMatch={msg.isMatch}
                handleClick={msg.isAssessed ? () => openDrawerBottom(msg.Id) : () => goVoting()}
              />
            </div>
          )
          )}
        </div>
        {selectedMsg ? <VoteDrawer openReview={openDrawer} closeDrawerBottom={closeDrawerBottom} id={selectedMsg.Id} text={selectedMsg.Text} voteRequest={selectedMsg.voteRequest} primaryCategory={selectedMsg.primaryCategory} /> : null}
        <div className='justify-end row-span-1'>
          <FilterVoteButton />
        </div>
      </div>
      <NavbarDefault />
    </div >
  );
}
