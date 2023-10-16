import React from "react";
import NavbarDefault from "./BotNavBar";
import Header from "./Header";
import TabsWithIcon from "./Tabs";
import PopoverDefault from "./Popover";

const DashboardLabel = {
  title: "Dashboard",
  info: "View your voting statistics here!",
};
export default function Dashboard() {
  return (
    <div style={{}}>
      <Header />
      {/* <TabsWithIcon /> */}
      <PopoverDefault/>
      <NavbarDefault />
    </div>
  );
}