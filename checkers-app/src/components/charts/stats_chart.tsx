import {
    Card,
    CardHeader,
    CardBody,
    Typography,
} from "@material-tailwind/react";
import Chart from "react-apexcharts";

interface PropType {
    title: string,
    description: string,
    chart: {
        // type?:
        // | "line"
        // | "area"
        // | "bar"
        // | "pie"
        // | "donut"
        // | "radialBar"
        // | "scatter"
        // | "bubble"
        // | "heatmap"
        // | "candlestick"
        // | "boxPlot"
        // | "radar"
        // | "polarArea"
        // | "rangeBar"
        // | "rangeArea"
        // | "treemap"; 
        options: ApexCharts.ApexOptions;
        series: ApexCharts.ApexOptions["series"];
    };
}

export default function StatisticsChart(Prop: PropType) {
    return (
        <Card>
            <CardHeader variant="gradient" color="orange">
                <Chart type="line"
                    options={Prop.chart.options}
                    series={Prop.chart.series} />
            </CardHeader>
            <CardBody className="p-6">
                <Typography variant="h6" color="blue-gray">
                    {Prop.title}
                </Typography>
                <Typography variant="small" className="font-normal text-blue-gray-600">
                    {Prop.description}
                </Typography>
            </CardBody>
        </Card>
    );
}


