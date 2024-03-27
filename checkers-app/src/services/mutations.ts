import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateChecker } from "../types";
import { patchChecker } from "./api";

export function useUpdateFactChecker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checkerUpdateData,
      checkerId,
    }: {
      checkerUpdateData: updateChecker;
      checkerId: string;
    }) => patchChecker({ checkerUpdateData, checkerId }),
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
