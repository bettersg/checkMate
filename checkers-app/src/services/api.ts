import axios from "axios";
import {
  Vote,
  VoteSummaryApiResponse,
  PendingCountApiResponse,
  LeaderboardEntry,
} from "../types";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import app from "../firebase";
import {
  createChecker,
  updateChecker,
  postWhatsappTestMessage,
  upsertCustomReply,
} from "../../../functions/src/definitions/api/interfaces";

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

export const patchChecker = async ({
  checkerUpdateData,
  checkerId,
}: {
  checkerUpdateData: updateChecker;
  checkerId: string;
}) => {
  await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData);
};

export const checkOTP = async (checkerId: string, otp: string) => {
  const response = await axiosInstance.post(
    `/api/checkers/${checkerId}/otp/check`,
    {
      otp,
    }
  );
  //check response http code
  if (response.status === 202) {
    //handles the case where user came from the whatsapp era
    const customToken = response.data?.customToken;
    const updatedCheckerId = response.data?.checkerId;
    if (!customToken || !updatedCheckerId) {
      throw new Error("Custom token or checkerId not found in response");
    }
    // if (checkerId === updatedCheckerId) {
    //   throw new Error(`Unexpected - checkerId ${checkerId} not updated`);
    // } //this could occur if the user has some issue after requesting OTP and then comes in again
    await axiosInstance.delete(`/api/checkers/${checkerId}`);
  }
  return response.data;
};

export const sendOTP = async (checkerId: string, whatsappId: string) => {
  return (
    await axiosInstance.post(`/api/checkers/${checkerId}/otp`, {
      whatsappId,
    })
  ).data;
};

export const postChecker = async ({
  checkerData,
  checkerId,
}: {
  checkerData: createChecker;
  checkerId: string;
}) => {
  return (await axiosInstance.post(`/api/checkers/${checkerId}`, checkerData))
    .data;
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
  category: string | null,
  communityNoteCategory: string | null,
  truthScore: number | null,
  tags: string[] | null,
) => {
  if (!messageId || !voteRequestId) {
    throw new Error("Message Id or Vote Request Id missing.");
  }
  if (category === null) {
    throw new Error("Category missing");
  }
  if (category === "info" && truthScore == null) {
    throw new Error("Truth score required for info vote.");
  }
  if (tags === null) {
    tags = [];
  }
  return (
    await axiosInstance.patch(
      `/api/messages/${messageId}/voteRequests/${voteRequestId}`,
      {
        category,
        communityNoteCategory, 
        truthScore,
        tags,
      }
    )
  ).data;
};

export const postCustomReply = async (
  messageId: string,
  checkerId: string,
  customReply: string
) => {
  if (!messageId) {
    throw new Error("Message Id missing.");
  }
  if (!checkerId) {
    throw new Error("Checker Id missing in postCustomReply.");
  }
  if (!customReply) {
    throw new Error("Custom reply missing.");
  }
  return (
    await axiosInstance.post(`/api/messages/${messageId}/customReply`, {
      factCheckerId: checkerId,
      customReply,
    } as upsertCustomReply)
  ).data;
};

export const getMessage = async (messageId: string) => {
  if (!messageId) {
    throw new Error("Message Id missing.");
  }
  return (await axiosInstance.get(`/api/messages/${messageId}`)).data;
};

export const getLeaderboard = async (
  checkerId: string
): Promise<LeaderboardEntry[]> => {
  if (!checkerId) {
    throw new Error("Checker ID missing in getLeaderboard.");
  }
  return (await axiosInstance.get(`/api/checkers/${checkerId}/leaderboard`))
    .data;
};

export const sendWhatsappTestMessage = async (
  checkerId: string,
  message: string
) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in sendWhatsappTestMessage.");
  }
  if (!message) {
    throw new Error("A message is required");
  }
  return (
    await axiosInstance.post(`/api/checkers/${checkerId}/whatsappTestMessage`, {
      message,
    } as postWhatsappTestMessage)
  ).data;
};

export const resetCheckerProgram = async (checkerId: string) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in resetCheckerProgram.");
  }
  const checkerUpdateData: updateChecker = {
    programData: "reset",
  };
  return (
    await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData)
  ).data;
};

export const withdrawCheckerProgram = async (checkerId: string) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in resetCheckerProgram.");
  }
  const checkerUpdateData: updateChecker = {
    programData: "withdraw",
  };
  return (
    await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData)
  ).data;
};

export const activateChecker = async (checkerId: string) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in activateChecker.");
  }
  const checkerUpdateData: updateChecker = {
    isActive: true,
  };
  return (
    await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData)
  ).data;
};

export const deactivateChecker = async (checkerId: string) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in deactivateChecker.");
  }
  const checkerUpdateData: updateChecker = {
    isActive: false,
  };
  return (
    await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData)
  ).data;
};

export const completeProgram = async (checkerId: string) => {
  if (!checkerId) {
    throw new Error("Checker ID missing in deactivateChecker.");
  }
  const checkerUpdateData: updateChecker = {
    programData: "complete",
  };
  return (
    await axiosInstance.patch(`/api/checkers/${checkerId}`, checkerUpdateData)
  ).data;
};
