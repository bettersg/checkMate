import React from "react";

import { Navbar, Typography, List, ListItem } from "@material-tailwind/react";

import {
  PresentationChartBarIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/solid";

export default function NavbarDefault() {
  return (
    <Navbar
      className="mx-auto py-2 px-6 fixed bottom-0 left-0 z-50 w-full h-16"
      style={{ backgroundColor: "#ff8932" }}
    >
      <div className="container mx-auto items-center justify-between flex-row gap-2">
        <List className="mt-0 mb-0 p-1 flex-row justify-between">
          <Typography as="a" href="/" style={{ color: "#ffffff" }}>
            <ListItem className="flex items-center gap-2 px-2 pr-2">
              <PresentationChartBarIcon className="h-[20px] w-[20px]" />
            </ListItem>
          </Typography>
          <Typography as="a" href="myvotes" style={{ color: "#ffffff" }}>
            <ListItem className="flex items-center gap-2 py-2 px-2">
              <CheckBadgeIcon className="h-[20px] w-[20px]" />
            </ListItem>
          </Typography>

          <Typography as="a" href="achievements" style={{ color: "#ffffff" }}>
            <ListItem className="flex items-center gap-2 py-2 px-2">
              <TrophyIcon className="h-[20px] w-[20px]" />
            </ListItem>
          </Typography>
        </List>
      </div>
    </Navbar>
  );
}
