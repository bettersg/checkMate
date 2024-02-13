import Dashboard from "../components/dashboard";
import Layout from "../components/common/Layout";
import { useFactChecker } from "../services/queries";
import Onboarding from "./Onboarding";

export default function DashboardPage() {

    const { data } = useFactChecker(607439831)

    if (!data) {
        return (
            <p>There was an error</p>
        )
    }

    if (!data.data.isOnboardingComplete) {
        return <Onboarding />
    }

    return (
        <Layout pageHeader="DASHBOARD">
            <Dashboard />
        </Layout>)
}