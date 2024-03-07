import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checker } from "../types";
import { postFactChecker } from "./api";

export function useUpdateFactChecker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Checker) => postFactChecker(data),
    onSettled: async (_, error, variables) => {
      if (error) {
        console.log(error);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["factChecker", { id: variables.telegramId }] });
      }
    }
  })
}