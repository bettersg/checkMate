import React from "react";
import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import TabsWithIcon from "../Tabs";
import PopoverDefault from "../Popover";

export default function Dashboard() {
  const dashboardLabel = {
    title: "Dashboard",
    info: "View your voting statistics",
  };
  return (
    <div style={{}}>
      <Header />
      {/* <TabsWithIcon /> */}
      <PopoverDefault props={dashboardLabel} />
      <NavbarDefault />
    </div>
  );
}
