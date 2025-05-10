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
      {/* <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={Note_Category_Data}
            dataKey="value"
            cx="40%"
            cy="50%"
            outerRadius={70}
            innerRadius={50}
            paddingAngle={0}
          >
            {Note_Category_Data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Legend layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer> */}
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
