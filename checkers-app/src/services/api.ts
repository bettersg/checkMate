import axios from "axios";
import {
  Checker,
  Vote,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
} from "../types";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import app from "../firebase";

const auth = getAuth(app);
if (import.meta.env.MODE === "dev") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); //TODO: FOR DEV ONLY, need to change env variables later.
}
// Create an Axios instance
export const axiosInstance = axios.create();

axiosInstance.interceptors.request.use(
  async (config) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getChecker = async (id: string) => {
  const returnData = (await axiosInstance.get(`/api/checkers/${id}`)).data;
  return returnData;
};

export const getCheckerPendingCount = async (
  checkerId: string
): Promise<PendingCountApiResponse> => {
  return (await axiosInstance.get(`/api/checkers/${checkerId}/pendingCount`))
    .data;
};

// export const updateFactChecker = async (data: FactChecker) => {
//   return (await axiosInstance.put(`/api/checkerData/${data.platformId}`, data));
// }

export const postChecker = async (data: Checker) => {
  return (await axiosInstance.post("/checkers", data)).data;
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
    await axiosInstance.get(`/api/checkers/${checkerId}/votes`, {
      params: query,
    })
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
    await axiosInstance.get(
      `/api/messages/${messageId}/voteRequests/${voteRequestId}`
    )
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
    await axiosInstance.patch(
      `/api/messages/${messageId}/voteRequests/${voteRequestId}`,
      {
        category,
        truthScore,
      }
    )
  ).data;
};
