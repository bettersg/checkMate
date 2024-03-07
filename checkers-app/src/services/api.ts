import axios from "axios"
import { Checker } from "../types"

export const getFactChecker = async (id: string) => {
  return (await axios.get(`/api/checkerData/${id}`)).data
}

// export const updateFactChecker = async (data: FactChecker) => {
//   return (await axios.put(`/api/checkerData/${data.platformId}`, data));
// }

export const postFactChecker = async (data: Checker) => {
  return (await axios.post("/checkers", data)).data
}
