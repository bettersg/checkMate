import { AssessedInfo } from "../../types";
import { VoteOption } from "./VoteOption";

interface VotingNoteChartProps {
  assessedInfo: AssessedInfo | null;
  communityNoteCategory: "great" | "acceptable" | "unacceptable" | null;
}

export default function VotingNoteChart(Props: VotingNoteChartProps) {
  const assessedInfo = Props.assessedInfo;

  const Note_Category_Data = [
    { name: "Great", value: assessedInfo?.greatCount},
    {
      name: "Acceptable",
      value: assessedInfo?.acceptableCount,
    },
    {
      name: "Unacceptable",
      value: assessedInfo?.unacceptableCount,
    },
  ];

  // Calculate total vote count 
  const totalVotes = Note_Category_Data.reduce((acc, options) => acc + (options.value ?? 0), 0);
  const maxVotesName =  Note_Category_Data.reduce((best, cur) => ((best.value ?? -Infinity) > (cur.value ?? -Infinity) ? best : cur)).name;


  return (
    <div className="w-full max-w-md mx-auto p-1 rounded-lg">
      <h2 className="text-primary-color3 mb-1 text-center text-lg font-bold">Community Note Category</h2>
      <h3 className = "mb-4 text-primary-color3 text-center text-sm">{totalVotes} total votes</h3>
      {Note_Category_Data.map((item) => (
        <VoteOption
          label={item.name}
          percentage={((item.value ?? 0) / totalVotes) * 100}
          votes={item.value ?? 0}
          selected={Props.communityNoteCategory === item.name.toLowerCase()}
          majority={Props.communityNoteCategory === maxVotesName.toLowerCase()}
        />
      ))}
    </div>
  );
}
