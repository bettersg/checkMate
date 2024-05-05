import { Card, Typography } from "@material-tailwind/react";
import {
  ClockIcon,
  UserIcon,
  TrophyIcon,
  HashtagIcon,
  CheckCircleIcon,
  CalculatorIcon,
} from "@heroicons/react/24/solid";
import { Tooltip } from "@material-tailwind/react";
import { useEffect, useState } from "react";
import { useUser } from "../../providers/UserContext";
import Loading from "../common/Loading";
import { LeaderboardEntry } from "../../types";
import { getLeaderboard } from "../../services/api";

const iconsize = "h-4 w-4";
const COLUMNS = [
  {
    title: "rank",
    icon: <TrophyIcon className={iconsize} />,
    description: "Rank",
  },
  {
    title: "name",
    icon: <UserIcon className={iconsize} />,
    description: "Name",
  },
  {
    title: "numVotes",
    icon: <HashtagIcon className={iconsize} />,
    description: "Number of votes on messages that did not end in unsure",
  },
  {
    title: "accuracy",
    icon: <CheckCircleIcon className={iconsize} />,
    description: "Accuracy (%) of votes on messages that did not end in unsure",
  },
  {
    title: "averageTimeTaken",
    icon: <ClockIcon className={iconsize} />,
    description:
      "Average time (hrs) taken on votes on messages that did not end in unsure",
  },
  {
    title: "score",
    icon: <CalculatorIcon className={iconsize} />,
    description: "Score, based on both accuracy and speed",
  },
];

const TABLE_ROWS = [
  {
    id: "1",
    position: 1,
    name: "Alice",
    numVoted: 100,
    accuracy: 99,
    averageTimeTaken: 30,
    score: 500,
  },
  {
    id: "2",
    position: 2,
    name: "Bob",
    numVoted: 100,
    accuracy: 97,
    averageTimeTaken: 28,
    score: 490,
  },
  {
    id: "3",
    position: 3,
    name: "Charlie",
    numVoted: 100,
    accuracy: 95,
    averageTimeTaken: 25,
    score: 480,
  },
  {
    id: "4",
    position: 4,
    name: "David",
    numVoted: 100,
    accuracy: 93,
    averageTimeTaken: 30,
    score: 470,
  },
  {
    id: "5",
    position: 5,
    name: "Eve",
    numVoted: 100,
    accuracy: 90,
    averageTimeTaken: 35,
    score: 460,
  },
  {
    id: "6",
    position: 6,
    name: "Faythe",
    numVoted: 100,
    accuracy: 89,
    averageTimeTaken: 20,
    score: 450,
  },
  {
    id: "7",
    position: 7,
    name: "Grace",
    numVoted: 100,
    accuracy: 88,
    averageTimeTaken: 22,
    score: 440,
  },
  {
    id: "8",
    position: 8,
    name: "Heidi",
    numVoted: 100,
    accuracy: 87,
    averageTimeTaken: 23,
    score: 430,
  },
  {
    id: "9",
    position: 9,
    name: "Ivan",
    numVoted: 100,
    accuracy: 85,
    averageTimeTaken: 25,
    score: 420,
  },
  {
    id: "d2Woe1h0x5Mw62n1vvxz",
    position: 11,
    name: "Judy",
    numVoted: 100,
    accuracy: 84,
    averageTimeTaken: 26,
    score: 410,
  },
  {
    id: "11",
    position: 12,
    name: "Michael",
    numVoted: 100,
    accuracy: 82,
    averageTimeTaken: 24,
    score: 400,
  },
];

export function LeaderboardTable() {
  let lastIndex = 0;
  const [isLoading, setIsLoading] = useState(false);
  const { checkerDetails } = useUser();
  const [abridgedLeaderboard, setAbridgedLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      if (!checkerDetails.checkerId) {
        return;
      }
      const leaderboard: LeaderboardEntry[] = await getLeaderboard(
        checkerDetails.checkerId
      );
      if (leaderboard) {
        setAbridgedLeaderboard(leaderboard);
        setIsLoading(false);
      }
    };
    if (checkerDetails.checkerId) {
      fetchLeaderboard();
    }
  }, [checkerDetails.checkerId]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <Card className="h-full w-full overflow-scroll">
      <table className="w-full min-w-max table-auto text-left">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.title}
                className="border-b border-blue-gray-100 bg-blue-gray-50 p-4"
              >
                <Tooltip content={col.description}>{col.icon}</Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {abridgedLeaderboard.map(
            (
              {
                id,
                position,
                name,
                numVoted,
                accuracy,
                averageTimeTaken,
                score,
              },
              index
            ) => {
              const discontinuity = position - lastIndex > 1;
              const isChecker = id === checkerDetails.checkerId;
              const isLast = index === abridgedLeaderboard.length - 1;
              const rowClasses = isChecker ? "bg-orange-100" : "";
              const classes = isLast
                ? "p-4"
                : "p-4 border-b border-blue-gray-50";
              lastIndex = position;

              return (
                <>
                  {discontinuity && (
                    <tr
                      key={`discontinuity-${position}`}
                      className="bg-gray-100"
                    >
                      <td colSpan={6} className="text-center p-4 italic">
                        <Typography
                          variant="small"
                          color="blue-gray"
                          className="font-normal"
                        >
                          ...
                        </Typography>
                      </td>
                    </tr>
                  )}
                  <tr key={name} className={rowClasses}>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {position}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {name}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {numVoted}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {(accuracy * 100).toFixed(0)}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-normal"
                      >
                        {(averageTimeTaken / 60).toFixed(2)}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography
                        variant="small"
                        color="blue-gray"
                        className="font-bold"
                      >
                        {score.toFixed(1)}
                      </Typography>
                    </td>
                  </tr>
                </>
              );
            }
          )}
        </tbody>
      </table>
    </Card>
  );
}
