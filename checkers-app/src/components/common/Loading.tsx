import { Spinner } from "@material-tailwind/react";

export default function Loading() {
  //TODO:MAKE A NICE LOADING SCREEN
  return (
    <div className="flex justify-center items-center h-screen">
      <Spinner className="h-8 w-8" color="orange" />
    </div>
  );
}
