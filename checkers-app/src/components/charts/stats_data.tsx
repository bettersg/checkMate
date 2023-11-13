import { chartsConfig } from "../../config/charts-config";

const totalVotesChart = {
  // type: "bar",
  series: [
    {
      name: "Votes",
      data: [5, 2, 10, 6, 4, 1, 4, 5, 2, 10, 6, 4, 1, 4, 5, 2, 10, 6, 4, 1, 4, 5, 2, 10, 6, 4, 1, 4],
    },
  ],
  options: {
    ...chartsConfig,
    plotOptions: {
      bar: {
        columnWidth: "16%",
        borderRadius: 5,
      },
    },
    xaxis: {
      ...chartsConfig.xaxis,
      categories: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28",],
    },
  },
};

const responseTimeChart = {
  // type: "line",
  series: [
    {
      name: "Time(s)",
      data: [95, 100, 90, 200, 320, 100, 120, 230, 220, 95, 100, 90, 200, 320, 100, 120, 230, 220, 95, 100, 90, 200, 320, 100, 120, 230, 220, 95, 100, 90, 200, 320, 100, 120, 230, 220],
    },
  ],
  options: {
    ...chartsConfig,
    // stroke: {
    //   lineCap: "round",
    // },
    // markers: {
    //   size: 5,
    // },
    xaxis: {
      ...chartsConfig.xaxis,
      categories:
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28",],
    },
  },
};


export const statisticsChartsData = [
  {
    title: "No. of Total Votes",
    description: "Total number of votes per day",
    chart: totalVotesChart,
  },
  {
    title: "Average response time(s)",
    description: "Average time taken to cast vote after viewing message",
    chart: responseTimeChart,
  },
];

export default statisticsChartsData;