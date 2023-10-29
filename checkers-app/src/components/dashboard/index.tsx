import NavbarDefault from "../../shared/BotNavBar";
import Header from "../../shared/Header";
import PageHeader from "../../shared/PageHeader";

export default function Dashboard() {
  return (
    <div>
      <Header>Samantha</Header> {/* To change to a dynamcially loaded name in the future */}
      <PageHeader>DASHBOARD</PageHeader>
      <NavbarDefault />
    </div>
  );
}
