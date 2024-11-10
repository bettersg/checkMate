import { PieChart, Pie, ResponsiveContainer, Cell, Legend } from "recharts";
import { AssessedInfo } from "../../types";
import { useEffect } from "react";

interface VotingTagChartProps {
    assessedInfo: AssessedInfo | null;
  }
export default function VotingTagChart(Props: VotingTagChartProps)  {
    
    const assessedInfo = Props.assessedInfo;
    console.log(assessedInfo)

    const tagData = [
       { name: 'Incorrect',value:assessedInfo?.tagCounts.incorrect},
       { name: 'Generated', value:assessedInfo?.tagCounts.generated}
    ]
    
    const COLORS = ['#FFBB28', '#FF8042'];

    return (
        <ResponsiveContainer width="100%" height={200}>
            <PieChart width={500} height={200}>
                <Pie
                    data={tagData}
                    cy = {120}
                    startAngle={180}
                    endAngle={0}
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) =>
                        value === 0 ? null : `${name}: ${value}`
                    }
                    labelLine = {false}
                    >
                    {tagData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    )
    
}

