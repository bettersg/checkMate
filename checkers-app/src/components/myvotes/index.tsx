import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import PopoverDefault from "../Popover";
import VoteInstanceButton from "./VoteInstanceButton";
import FilterVoteButton from "./FilterVotes";

export default function MyVotes() {
  const myVotesLabel = {
    title: "My Votes",
    info: "View your vote history",
  };

  return (
    <div style={{}}>
      <Header />
      {/* <TabsWithIcon /> */}
      <PopoverDefault title={myVotesLabel.title}
        info={myVotesLabel.info} />
      <div className="grid grid-col-3 grid-flow-col gap-4">
        <div className="col-span-2 grid-flow-row">
          <div>
            <VoteInstanceButton />
          </div>
          <div>
            <VoteInstanceButton />
          </div>
        </div>
        <div>
          <FilterVoteButton />
        </div>
      </div>
      <NavbarDefault />
    </div>
  );
}
