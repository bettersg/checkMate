import NavbarDefault from "../BotNavBar";
import Header from "../Header";
import PageHeader from "../PageHeader";

export default function Dashboard() {
  return (
    <div>
      <Header>Samantha</Header> {/* To change to a dynamcially loaded name in the future */}
      <PageHeader>DASHBOARD</PageHeader>
      <NavbarDefault />
    </div>
  );
}
