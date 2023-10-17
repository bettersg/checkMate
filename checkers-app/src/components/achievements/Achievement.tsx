import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import PopoverDefault from "../Popover";

export default function Achievement() {
  const achievementLabel = {
    title: "Achievement",
    info: "View voting achievements",
  };
  return (
    <div style={{}}>
      <Header />
      {/* <TabsWithIcon /> */}
      <PopoverDefault props={achievementLabel} />
      <NavbarDefault />
    </div>
  );
}
