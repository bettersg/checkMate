import NavbarDefault from "../BotNavBar";
import Header from "../Header";
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
      <PopoverDefault title={dashboardLabel.title} info={dashboardLabel.info} />
      <NavbarDefault />
    </div>
  );
}
