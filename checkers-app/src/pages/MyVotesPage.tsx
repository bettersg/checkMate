import MyVotes from "../components/myvotes";
import Layout from "../shared/Layout";

export default function MyVotesPage (){
    return (
        <Layout name="Samantha" pageHeader="MY VOTES" user_unassessed={1}>
            <MyVotes/>
        </Layout>
    )
}