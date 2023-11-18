import PendingMessageAlert from "./PendingMsgAlert";
import StatisticsChart from "../charts/stats_chart";
import SelectTimePeriod from "./PeriodSelection";
import statisticsChartsData from "../charts/stats_data";


export default function Dashboard() {
  return (
    <div className="flex flex-col gap-y-4">


      <PendingMessageAlert Type={true} />
      <PendingMessageAlert Type={false} />
      <SelectTimePeriod />
      <div className="my-6 grid grid-cols-1 gap-y-12 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
        {statisticsChartsData.map((props) => (
          <StatisticsChart
            key={props.title}
            title={props.title}
            description={props.description}
            chart={props.chart}
          />
        ))}
      </div>
    </div>
  );
}
