/* 
Component to categorise and display the messages.

Includes a "PENDING" and "VOTED" tab depending on the status of the message.

Subcategories of the messages include:
- Urgent (PENDING)
- Expired (PENDING)
- Awaiting results (VOTED)
- Correctly voted (VOTED)
- Incorrectly voted (VOTED)

Idea:
- Get the messages from the UserContext
- Filter messages based on the status of the message
- Have a nested component for each button
*/

import { useState, useEffect, FC } from "react";
import { useUser } from "../../providers/UserContext";
import Loading from "../common/Loading";
import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { getCheckerVotes } from "../../services/api";
import { VoteSummary, VoteSummaryApiResponse } from "../../types";
import Pagination from "./Pagination"; // Make sure to create this component

const MessagesDisplay: FC = () => {
  const { checkerId } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [votes, setVotes] = useState<VoteSummary[]>([]);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "voted">("pending");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        if (!checkerId) {
          throw new Error("Checker Id missing.");
        }
        const response: VoteSummaryApiResponse = await getCheckerVotes(
          checkerId,
          activeTab.toLowerCase(),
          5,
          lastPath
        );
        // Assuming your API correctly maps to the ApiResponse interface
        if (response.votes) {
          setVotes(response.votes);
        }
        setTotalPages(response.totalPages);
        setLastPath(response.lastPath);
        setIsLoading(false);
      } catch (err) {
        setError("Failed to fetch messages");
        setIsLoading(false);
      }
    };
    if (checkerId) {
      fetchMessages();
    }
  }, [checkerId, activeTab, currentPage]);

  const handleTabChange = (tab: "pending" | "voted") => {
    setActiveTab(tab);
    handlePageChange(1); // Reset to the first page whenever the tab changes
  };

  // Function to handle page change from the Pagination component
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (page === 1) {
      setLastPath(null);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div>
      <div className="flex justify-around relative shadow-md shadow-primary-color2/50">
        <button
          className={`w-1/2 text-center py-2 ${
            activeTab === "pending"
              ? "border-b-2 border-primary-color2 text-primary-color2"
              : "text-gray-400"
          } font-bold`}
          onClick={() => handleTabChange("pending")}
        >
          PENDING
        </button>
        <button
          className={`w-1/2 text-center py-2 ${
            activeTab === "voted"
              ? "border-b-2 border-primary-color2 text-primary-color2"
              : "text-gray-400"
          } font-bold`}
          onClick={() => handleTabChange("voted")}
        >
          VOTED
        </button>
      </div>
      <div
        className="overflow-auto min-h-full"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {error && <div>{error}</div>}
        {!error && votes.length === 0 && (
          <div className="text-primary-color h-full flex justify-center pt-16">
            <Typography>No messages found.</Typography>
          </div>
        )}
        {!error &&
          votes.map((voteSummary, index) => (
            <div key={index}>
              <MessageCard voteSummary={voteSummary} status={activeTab} />
            </div>
          ))}
      </div>
      {!error && votes.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default MessagesDisplay;
