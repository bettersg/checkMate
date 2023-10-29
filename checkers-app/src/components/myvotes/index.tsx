import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import PageHeader from "../PageHeader";
import VoteInstanceButton from "./VoteInstanceButton";
import FilterVoteButton from "./FilterVotes";

export default function MyVotes() {

  return (
    <div style={{}}>
      <Header>Samantha</Header>
      <PageHeader>MY VOTES</PageHeader>
      <div className="grid grid-col-3 grid-flow-col gap-4">
        <div className="col-span-2 grid-flow-row"> {/* TODO: Change to a whole "VoteDisplay" component once we have finalised the API for votes */}
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
