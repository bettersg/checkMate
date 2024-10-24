import { useState } from "react";
import {
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
} from "@material-tailwind/react";
import { useNavigate } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/20/solid";
import { useUser } from "../../providers/UserContext";
import {
  resetCheckerProgram,
  deactivateChecker,
  activateChecker,
} from "../../services/api";

interface PropType {
  isActive: boolean;
}

const menuOptions = {
  activate: {
    header: "Ready to Resume",
    body: "Welcome back! Click if you're ready to resume receiving messages to vote on from CheckMate.",
  },
  deactivate: {
    header: "Take a Break",
    body: "Are you sure you want to deactivate your account? You will no longer receive messages to vote on from CheckMate. You can come back here again anytime to reactivate your account.",
  },
  resetProgram: {
    header: "Restart Program",
    body: "Are you sure you want to restart your program? You will lose all your progress and start from the beginning.",
  },
};

export default function MenuComponent(Props: PropType) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { checkerDetails } = useUser();
  const [dialogHeader, setDialogHeader] = useState<string>("");
  const [dialogBody, setDialogBody] = useState<string>("");
  const [intent, setIntent] = useState<string>("");

  const handleMenuItemClick = (optionKey: keyof typeof menuOptions) => {
    const { header, body } = menuOptions[optionKey];
    setDialogHeader(header);
    setDialogBody(body);
    setDialogOpen(true);
    setIntent(optionKey);
  };

  const handleConfirm = async () => {
    if (!checkerDetails.checkerId) {
      return;
    }
    if (intent === "activate") {
      await activateChecker(checkerDetails.checkerId);
    } else if (intent === "deactivate") {
      await deactivateChecker(checkerDetails.checkerId);
    } else if (intent === "resetProgram") {
      await resetCheckerProgram(checkerDetails.checkerId);
    }
    setDialogOpen(false);
    navigate(0);
  };

  const handleCancel = () => {
    setDialogOpen(false);
  };

  return (
    <div>
      <Menu>
        <MenuHandler>
          <Bars3Icon className="h-6 w-6 text-gray-700 cursor-pointer hover:text-gray-900 transition-colors" />
        </MenuHandler>
        <MenuList>
          <MenuItem
            onClick={() =>
              handleMenuItemClick(Props.isActive ? "deactivate" : "activate")
            }
          >
            {Props.isActive
              ? menuOptions.deactivate.header
              : menuOptions.activate.header}
          </MenuItem>
          <MenuItem onClick={() => handleMenuItemClick("resetProgram")}>
            {menuOptions.resetProgram.header}
          </MenuItem>

          {/* New "View Certificate" Menu Item */}
          {checkerDetails.certificateUrl && (
            <MenuItem
              onClick={() =>
                window.open(checkerDetails.certificateUrl as string, "_blank")
              }
            >
              View Certificate
            </MenuItem>
          )}
        </MenuList>
      </Menu>

      {/* Existing Dialog for activation/deactivation */}
      <Dialog open={dialogOpen} handler={handleCancel} size="xs">
        <DialogHeader>{dialogHeader}</DialogHeader>
        <DialogBody divider>{dialogBody}</DialogBody>
        <DialogFooter>
          <Button variant="text" color="red" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="gradient" color="green" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
