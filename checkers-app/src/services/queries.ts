import { useQuery } from "@tanstack/react-query";
import { getFactChecker } from "./api";

export function useFactChecker(id: number | null) {
  return useQuery({
    queryKey: ["factChecker", { id }],
    queryFn: () => getFactChecker(id!)
  })
}