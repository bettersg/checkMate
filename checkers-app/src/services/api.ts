import axios from "axios"

// const BASE_URL = import.meta.env.DEV ? "http://127.0.0.1:5000" : "PROD ENDPOINT"
// const BASE_URL = "http://127.0.0.1:5000"
// const axiosInstance = axios.create({ baseURL: BASE_URL })

export const getFactChecker = async (id: number) => {
  return (await axios.get(`/api/checkerData/${id}`)).data
}