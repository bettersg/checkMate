import { Typography } from "@material-tailwind/react";
import AchievementCard from "./AchievementCard";
import Badge from "./Badge";

//replace with actual data frm firebase
const BADGES = [
  { name: 'Spark', icon: './fire.png', description: 'Reach a 10-day streak (3/10)', status: 30 },
  { name: 'Sniper', icon: './vision.png', description: 'Vote with >90% accuracy (9/10)', status: 90 },
  { name: 'Flash', icon: './clock.png', description: 'Assess messages within 30s (1/10)', status: 10 },
  { name: 'FactChecker', icon: './magnify.png', description: 'Assess at least 3 messages daily (1/10)', status: 10 },
]
export default function Achievement() {
  return (
    <div className="left-right-padding">
      <AchievementCard number={3} rank='Rookie' />
      <Typography variant="h4" className="text-primary-color mt-2">Badges</Typography>
      {BADGES.map((badge, index) => (
        <Badge key={index} name={badge.name} icon={badge.icon} description={badge.description} status={badge.status} />
      ))}
    </div>
  );
}
