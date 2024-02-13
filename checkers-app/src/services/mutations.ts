import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FactChecker } from "../types/factChecker";
import { updateFactChecker } from "./api";

export function useUpdateFactChecker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FactChecker) => updateFactChecker(data),
    onSettled: async (_, error, variables) => {
      if (error) {
        console.log(error);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["factChecker", { id: variables.platformId }] });
      }
    }
  })
}