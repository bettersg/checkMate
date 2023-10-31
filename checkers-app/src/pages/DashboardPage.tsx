import Dashboard from "../components/dashboard";
import Layout from "../shared/Layout";

export default function DashboardPage (){
    return (
    <Layout name="Samantha" pageHeader="DASHBOARD" user_unassessed={1}>
        <Dashboard/> 
    </Layout>)
}