import Dashboard from "../components/dashboard";
import Layout from "../components/common/Layout";

export default function DashboardPage() {
  return (
    <Layout pageName="DASHBOARD" showMenu={true}>
      <Dashboard />
    </Layout>
  );
}
