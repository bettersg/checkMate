import Dashboard from "../components/dashboard";
import Layout from "../components/common/Layout";
import { useFactChecker } from "../services/queries";
import Onboarding from "./Onboarding";

export default function DashboardPage() {
  const { data } = useFactChecker(import.meta.env.VITE_CHECKER_ID as string);

  if (!data) {
    return <p>There was an error</p>;
  }

  console.log(data);

  if (!data.isOnboardingComplete) {
    return <Onboarding factChecker={data.data} />;
  }

  return (
    <Layout pageName="DASHBOARD">
      <Dashboard />
    </Layout>
  );
}
