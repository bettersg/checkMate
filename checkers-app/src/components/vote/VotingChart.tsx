import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AssessedInfo } from "../../types";

interface VotingChartProps {
  assessedInfo: AssessedInfo | null;
}

export default function VotingChart(Props: VotingChartProps) {
  const assessedInfo = Props.assessedInfo;

  if (assessedInfo === null) {
    return null;
  }
  const infoObj =
    "total" in assessedInfo.infoCount
      ? {
          name: "Info",
          count: assessedInfo.infoCount.total,
        }
      : {
          name: "Info",
          0: assessedInfo.infoCount["0"],
          1: assessedInfo.infoCount["1"],
          2: assessedInfo.infoCount["2"],
          3: assessedInfo.infoCount["3"],
          4: assessedInfo.infoCount["4"],
          5: assessedInfo.infoCount["5"],
        };

  const irrelevantCount = assessedInfo.irrelevantCount;

  const data = [
    {
      name: "Scam",
      count: assessedInfo.scamCount,
    },
    {
      name: "Illicit",
      count: assessedInfo.illicitCount,
    },
    infoObj,
    {
      name: "Satire",
      count: assessedInfo.satireCount,
    },
    {
      name: "Mktg",
      count: assessedInfo.spamCount,
    },
    {
      name: "NVC",
      credible: assessedInfo.legitimateCount,
      canttell: irrelevantCount,
    },
    {
      name: "Unsure",
      count: assessedInfo.unsureCount,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        width={500}
        height={300}
        data={data}
        margin={{
          top: 5,
          right: 5,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} tick={{ fontSize: 12, dy: 5 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" stackId="a" fill="#8884d8" />
        <Bar dataKey="0" stackId="a" fill="#FFE5B4" /> {/* Light Peach */}
        <Bar dataKey="1" stackId="a" fill="#FFC04C" /> {/* Orange Yellow */}
        <Bar dataKey="2" stackId="a" fill="#FFB347" /> {/* Orange */}
        <Bar dataKey="3" stackId="a" fill="#FF8C00" /> {/* Dark Orange */}
        <Bar dataKey="4" stackId="a" fill="#E67300" /> {/* Pumpkin */}
        <Bar dataKey="5" stackId="a" fill="#CC5500" /> {/* Burnt Orange */}
        <Bar dataKey="credible" stackId="a" fill="#82ca9d" />
        <Bar dataKey="canttell" stackId="a" fill="#808080" />
      </BarChart>
    </ResponsiveContainer>
  );
}
