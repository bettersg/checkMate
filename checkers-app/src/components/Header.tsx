import React from "react";
import { Typography } from "@material-tailwind/react";

export default function Header() {
  return (
    <div className="container items-center justify-between flex-row flex">
      <div
        className="left-0 mx-0 px-4 mt-4 text-left"
        style={{ alignItems: "start", position: "relative" }}
      >
        <Typography
          variant="h2"
          style={{ color: "#f99301", alignContent: "start" }}
        >
          Hello, Sally
        </Typography>
      </div>
      <img className="rounded-full mr-4 h-[50px] w-[50px]" src="/logo-1.jpg" />
    </div>
  );
}
