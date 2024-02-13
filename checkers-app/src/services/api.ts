import axios from "axios"
import { FactChecker } from "../types/factChecker"

// const BASE_URL = import.meta.env.DEV ? "http://127.0.0.1:5000" : "PROD ENDPOINT"
// const BASE_URL = "http://127.0.0.1:5000"
// const axiosInstance = axios.create({ baseURL: BASE_URL })

export const getFactChecker = async (id: string) => {
  return (await axios.get(`/api/checkerData/${id}`)).data
}

export const updateFactChecker = async (data: FactChecker) => {
  return (await axios.put(`/api/checkerData/${data.platformId}`, data));
}