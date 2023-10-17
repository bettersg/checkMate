import React from "react";
import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import TabsWithIcon from "../Tabs";
import PopoverDefault from "../Popover";

export default function MyVotes() {
  const myVotesLabel = {
    title: "My Votes",
    info: "View your vote history",
  };

  return (
    <div style={{}}>
      <Header />
      {/* <TabsWithIcon /> */}
      <PopoverDefault props={myVotesLabel} />
      <NavbarDefault />
    </div>
  );
}
