import { useQuery } from "@tanstack/react-query";
import { getChecker } from "./api";

export function useFactChecker(id: string | null) {
  return useQuery({
    queryKey: ["factChecker", { id }],
    queryFn: () => getChecker(id!),
  });
}
