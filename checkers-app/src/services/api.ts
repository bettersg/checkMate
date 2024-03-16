import axios from "axios";
import {
  Checker,
  Vote,
  VoteSummary,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
} from "../types";

export const getChecker = async (id: string) => {
  return (await axios.get(`/api/checkers/${id}`)).data;
};

export const getCheckerPendingCount = async (
  checkerId: string
): Promise<PendingCountApiResponse> => {
  return (await axios.get(`/api/checkers/${checkerId}/pendingCount`)).data;
};

// export const updateFactChecker = async (data: FactChecker) => {
//   return (await axios.put(`/api/checkerData/${data.platformId}`, data));
// }

export const postChecker = async (data: Checker) => {
  return (await axios.post("/checkers", data)).data;
};

export const getCheckerVotes = async (
  checkerId: string,
  status: string,
  n: number = 10,
  lastPath: string | null = null
): Promise<VoteSummaryApiResponse> => {
  if (!checkerId) {
    throw new Error("Checker Id missing.");
  }
  if (!["pending", "voted", "both"].includes(status)) {
    throw new Error("Invalid status");
  }
  const query = {
    n,
    last: lastPath,
    status,
  };
  return (
    await axios.get(`/api/checkers/${checkerId}/votes`, { params: query })
  ).data;
};

export const getVote = async (
  messageId: string,
  voteRequestId: string
): Promise<Vote> => {
  if (!messageId || !voteRequestId) {
    throw new Error("Message Id or Vote Request Id missing.");
  }
  return (
    await axios.get(`/api/messages/${messageId}/voteRequests/${voteRequestId}`)
  ).data;
};

export const patchVote = async (
  messageId: string,
  voteRequestId: string,
  category: string,
  truthScore: number | null
) => {
  if (!messageId || !voteRequestId) {
    throw new Error("Message Id or Vote Request Id missing.");
  }
  if (category === "info" && truthScore == null) {
    throw new Error("Truth score required for info vote.");
  }
  return (
    await axios.patch(
      `/api/messages/${messageId}/voteRequests/${voteRequestId}`,
      {
        category,
        truthScore,
      }
    )
  ).data;
};
