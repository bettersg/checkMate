import React from "react";
import {
  Tabs,
  TabsHeader,
  TabsBody,
  Tab,
  TabPanel,
} from "@material-tailwind/react";
import {
  PresentationChartBarIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

export default function TabsWithIcon() {
  const data = [
    {
      label: "Dashboard",
      value: "dashboard",
      icon: PresentationChartBarIcon,
      desc: (
        <div>
          <h1>hello</h1>
        </div>
      ),
    },
    {
      label: "My Votes",
      value: "votes",
      icon: CheckBadgeIcon,
      desc: `help`,
    },
    {
      label: "Achievements",
      value: "achievements",
      icon: TrophyIcon,
      desc: <div>hope this works</div>,
    },
  ];
  return (
    <div className="px-4">
      <Tabs value="dashboard">
        <TabsHeader>
          {data.map(({ label, value, icon }) => (
            <Tab key={value} value={value}>
              <div className="flex items-center gap-2">
                {React.createElement(icon, { className: "w-5 h-5" })}
                {label}
              </div>
            </Tab>
          ))}
        </TabsHeader>
        <TabsBody>
          {data.map(({ value, desc }) => (
            <TabPanel key={value} value={value}>
              {desc}
            </TabPanel>
          ))}
        </TabsBody>
      </Tabs>
    </div>
  );
}
