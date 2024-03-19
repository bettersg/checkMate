import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Checker } from "../types";
import { updateChecker } from "./api";

export function useUpdateFactChecker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checkerData,
      checkerId,
    }: {
      checkerData: Checker;
      checkerId: string;
    }) => updateChecker({ checkerData, checkerId }),
    onSettled: async (_, error, variables) => {
      if (error) {
        console.log(error);
      } else {
        await queryClient.invalidateQueries({
          queryKey: ["factChecker", variables.checkerId],
        });
      }
    },
  });
}
