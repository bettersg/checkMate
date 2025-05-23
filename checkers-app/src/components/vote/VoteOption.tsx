import React, { useEffect, useState } from "react";
import { Typography } from "@material-tailwind/react";

export interface VoteOptionProps {
  label: string;
  percentage: number;
  votes: number;
  selected?: boolean; // Choice of the user
}

export const VoteOption: React.FC<VoteOptionProps> = ({
  label,
  percentage,
  votes,
  selected,
}) => {
  const color = selected ? "orange" : "gray"; // Default color for the bar
  // local state to trigger the bar animation on mount
  const [fill, setFill] = useState<number>(0);

  useEffect(() => {
    // Provide some slight delay to trigger the bar animation
    const id = window.setTimeout(() => setFill(percentage), 50);
    return () => window.clearTimeout(id);
  }, [percentage]);

  // Default background color
  const bgShade = selected ? `bg-${color}-50` : "";
  const barColor = `bg-${color}-500`;

  return (
    <div
      className={`${bgShade} flex items-start gap-4 p-4 mb-4 rounded-lg border-2 border-solid 
            ${selected ? "border-orange-400" : `border-gray-200`}`}
    >
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <Typography variant="paragraph" className="font-medium">
            {label}
          </Typography>
          <Typography variant="paragraph" className="font-medium">
            {percentage.toFixed(2)}%
          </Typography>
        </div>
        {/* Animated bar */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
          <div
            className={`h-full ${
              selected ? barColor : "bg-gray-500"
            } rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${fill}%` }}
          />
        </div>
        <div className="text-right mt-1">
          <Typography variant="small" className="text-gray-500">
            {votes} votes
          </Typography>
        </div>
      </div>
    </div>
  );
};
