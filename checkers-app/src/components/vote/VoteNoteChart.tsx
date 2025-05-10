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


  return (
    <div className="w-full max-w-md mx-auto p-1 bg-white rounded-lg">
      <h2 className="mb-4 text-center text-lg font-bold">Community Note Category</h2>
      {Note_Category_Data.map((item) => (
        <VoteOption
          label={item.name}
          percentage={((item.value ?? 0) / totalVotes) * 100}
          votes={item.value ?? 0}
          selected={Props.communityNoteCategory === item.name.toLowerCase()}
        />
      ))}
    </div>
  );
}
