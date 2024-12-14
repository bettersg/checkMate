import { PieChart, Pie, ResponsiveContainer, Sector, Cell, Legend } from "recharts";
import { AssessedInfo } from "../../types";

interface VotingNoteChartProps {
    assessedInfo: AssessedInfo | null;
}


export default function VotingNoteChart(Props: VotingNoteChartProps) {
    const assessedInfo = Props.assessedInfo
    console.log(assessedInfo)

    const Note_Category_Data = [
        { name: 'Great', value: assessedInfo?.greatCount, color:"#8AC926" },
        { name: 'Acceptable', value: assessedInfo?.acceptableCount, color: "#FFCA3A" },
        { name: 'Unacceptable', value:assessedInfo?.unacceptableCount, color: "#FF595E"}
    ]

    const COLORS = Note_Category_Data.map((item) => item.color);

    return (
        <div className="w-full max-w-md mx-auto p-1 bg-white rounded-lg">
         <h2 className="text-center text-lg font-bold">Community Note Category</h2>
         <ResponsiveContainer width="100%" height={200}>
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
                    {Note_Category_Data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                </Pie>
                <Legend layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
         </ResponsiveContainer>
        </div>
    )
}