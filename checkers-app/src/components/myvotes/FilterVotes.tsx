import {
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Button,
} from "@material-tailwind/react";
import { FunnelIcon } from "@heroicons/react/24/solid";

export default function FilterVoteButton() {
  return (
    <Menu>
      <MenuHandler>
        <Button
          variant="text"
          className="flex gap-3 text-base font-normal capitalize tracking-normal px-3 py-3 items-center m-0 rounded-full"
        >
          <FunnelIcon color="#61dafbaa" className="h-[20px] w-[20px]" />
          Filter
        </Button>
      </MenuHandler>
      <MenuList>
        <MenuItem>Pending</MenuItem>
        <MenuItem>Assessed</MenuItem>
        <MenuItem>Review</MenuItem>
      </MenuList>
    </Menu>
  );
}
