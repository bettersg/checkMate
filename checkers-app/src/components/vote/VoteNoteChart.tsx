import { PieChart, Pie, ResponsiveContainer, Cell, Legend } from "recharts";
import { AssessedInfo } from "../../types";

interface VotingNoteChartProps {
    assessedInfo: AssessedInfo | null;
}

export default function VotingNoteChart(Props: VotingNoteChartProps) {
    const assessedInfo = Props.assessedInfo
    console.log(assessedInfo)

    return (
        <div>
            
        </div>
    )
}