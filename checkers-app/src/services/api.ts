import axios from "axios";
import { Checker, Vote, VoteSummary, VoteSummaryApiResponse } from "../types";

export const getFactChecker = async (id: string) => {
  return (await axios.get(`/api/checkers/${id}`)).data;
};

// export const updateFactChecker = async (data: FactChecker) => {
//   return (await axios.put(`/api/checkerData/${data.platformId}`, data));
// }

export const postFactChecker = async (data: Checker) => {
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
  console.log(checkerId);
  console.log("calling getCheckerVotes", query);
  return (
    await axios.get(`/api/checkers/${checkerId}/votes`, { params: query })
  ).data;
};

export const getVote = async (firestorePath: string): Promise<Vote> => {
  if (!firestorePath) {
    throw new Error("Firestore path missing.");
  }
  return (await axios.get(`/api/votes/${firestorePath}`)).data;
};
