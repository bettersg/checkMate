import { PieChart, Pie, ResponsiveContainer, Cell, Legend } from "recharts";
import { AssessedInfo } from "../../types";
import { Typography } from "@material-tailwind/react";

interface VotingTagChartProps {
    assessedInfo: AssessedInfo | null;
  }
export default function VotingTagChart(Props: VotingTagChartProps)  {

     const assessedInfo = Props.assessedInfo;
     console.log(assessedInfo)
     const totalResponse = Props.assessedInfo?.responseCount
     const Incorrect_Tag_Data =
        assessedInfo && totalResponse
            ? [
                { name: 'Tagged as Incorrect', value: assessedInfo.tagCounts.incorrect },
                {
                name: 'Not Tagged as Incorrect',
                value: totalResponse - assessedInfo.tagCounts.incorrect,
                },
            ]
            : [];

     const Generated_Tag_Data = 
            assessedInfo && totalResponse 
                ? [
                    {name: 'Tagged as Generated', value: assessedInfo.tagCounts.generated},
                    {
                        name: 'Not Tagged as Generated',
                        value: totalResponse - assessedInfo.tagCounts.generated
                    }
                ]
                : [];
    
    
    const COLORS = ['#FFBB28', '#FF8042'];

    return (
        <div>
            {Incorrect_Tag_Data.length > 0 && Incorrect_Tag_Data[1].value !== totalResponse && 
            <div>
                <Typography
                className="text-primary-color3 dark:text-white"
                variant="h5"
                >
                Incorrect Tag Analysis:
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart width={500} height={200}>
                        <Pie
                            data={Incorrect_Tag_Data}
                            cy = {120}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ value }) =>
                                value === 0 ? null : `${value}`
                            }
                            labelLine = {false}
                            >
                            {Incorrect_Tag_Data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>}
            
            {Generated_Tag_Data.length > 0 && Generated_Tag_Data[1].value !== totalResponse && 
            <div>
                <Typography
                    className="text-primary-color3 dark:text-white"
                    variant="h5"
                    >
                    AI Generated Tag Analysis:
                </Typography>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart width={500} height={200}>
                        <Pie
                            data={Generated_Tag_Data}
                            cy = {120}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ value }) =>
                                value === 0 ? null : `${value}`
                            }
                            labelLine = {false}
                            >
                            {Generated_Tag_Data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>}
        </div>
    ) 
}

