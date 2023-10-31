import Achievement from "../components/achievements";
import Layout from "../shared/Layout";

export default function AcheivementPage() {
    return (
        <Layout name="Samantha" pageHeader="ACHIEVEMENTS" user_unassessed={1}>
            <Achievement />
        </Layout>
    )

}