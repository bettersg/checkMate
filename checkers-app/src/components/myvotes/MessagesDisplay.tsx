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

interface MessagesDisplayProps {
  status: "pending" | "voted";
  scrollPosition: number;
}

import { useState, useEffect, FC, useCallback, useRef } from "react";
import { useUser } from "../../providers/UserContext";
// import Loading from "../common/Loading";
import MessageCard from "./MessageCard";
import { Typography } from "@material-tailwind/react";
import { getCheckerVotes } from "../../services/api";
import { VoteSummary, VoteSummaryApiResponse } from "../../types";
//import Pagination from "./Pagination"; // Make sure to create this component

const MessagesDisplay: FC<MessagesDisplayProps> = ({
  status,
  scrollPosition,
}) => {
  const { checkerDetails } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [votes, setVotes] = useState<VoteSummary[]>([]);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "voted">(status);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [error, setError] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [scrollY, setScrollY] = useState<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll Functions
  const handleScroll = () => {
    const scrollY = window.scrollY;
    setScrollY(scrollY);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (scrollY >= scrollPosition) {
      return;
    } else if (scrollPosition !== 0) {
      setTimeout(() => {
        window.scrollTo({
          top: scrollPosition,
          behavior: "smooth",
        });
      }, 200);
    }
  }, [votes]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      if (!checkerDetails.checkerId) {
        throw new Error("Checker Id missing.");
      }
      const response: VoteSummaryApiResponse = await getCheckerVotes(
        checkerDetails.checkerId,
        activeTab.toLowerCase(),
        10,
        lastPath
      );
      if (response.votes) {
        setVotes((prevVotes) => [...prevVotes, ...response.votes]);
      }
      setTotalPages(response.totalPages);
      setLastPath(response.lastPath);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to fetch messages");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (checkerDetails.checkerId) {
      fetchMessages();
    }
  }, [checkerDetails.checkerId, activeTab, page]);

  const handleTabChange = (tab: "pending" | "voted") => {
    setVotes([]);
    setActiveTab(tab);
    handlePageChange(1); // Reset to the first page whenever the tab changes
  };

  const observer = useRef<IntersectionObserver | null>(null);
  // Function to use the Intersection Observer API
  const lastMessageElementRef = useCallback(
    (node: any) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && page !== totalPages) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading]
  );

  // Function to handle page change from the Pagination component
  const handlePageChange = (page: number) => {
    setPage(page);
    if (page === 1) {
      setLastPath(null);
    }
  };

  return (
    <div>
      <div className="sticky top-0 bg-white z-10">
        <div className="flex justify-around relative shadow-md shadow-primary-color2/5">
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
      </div>
      <div className="flex-grow overflow-scroll" ref={scrollRef}>
        {error && <div>{error}</div>}
        {!error && votes.length === 0 && (
          <div className="text-primary-color h-full flex justify-center pt-16">
            <Typography>No messages found.</Typography>
          </div>
        )}
        {!error &&
          votes.map((voteSummary, index) => (
            <div
              key={index}
              ref={votes.length === index + 1 ? lastMessageElementRef : null}
            >
              <MessageCard
                voteSummary={voteSummary}
                status={activeTab}
                scrollPosition={scrollY}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

export default MessagesDisplay;
