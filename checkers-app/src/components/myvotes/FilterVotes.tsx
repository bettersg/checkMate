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
          className="flex justify-center gap-3 text-primary-color3 text-md capitalize tracking-normal rounded-full w-full"
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
