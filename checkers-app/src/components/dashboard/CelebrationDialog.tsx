import React from "react";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  Typography,
  Button,
} from "@material-tailwind/react";
import { completeProgram, deactivateChecker } from "../../services/api";
import { useUser } from "../../providers/UserContext";
import { useNavigate } from "react-router-dom";

interface PropType {
  display: boolean;
}

export function CelebrationDialog(props: PropType) {
  const [open, setOpen] = React.useState(props.display);
  const { checkerDetails } = useUser();
  const navigate = useNavigate();
  const handleOpen = () => setOpen(!open);

  const handleContinue = async () => {
    if (checkerDetails.checkerId) {
      await completeProgram(checkerDetails.checkerId);
      setOpen(false);
      navigate(0);
    }
  };

  const handleNoContinue = async () => {
    if (checkerDetails.checkerId) {
      await completeProgram(checkerDetails.checkerId);
      await deactivateChecker(checkerDetails.checkerId);
      setOpen(false);
      navigate(0);
    }
  };

  return (
    <>
      <Dialog open={open} handler={handleOpen}>
        <DialogBody divider className="grid place-items-center gap-4">
          <img
            src="/confetti.png"
            alt="..."
            className="w-16 h-16 rounded-full mx-auto mb-4"
          />
          <Typography color="red" variant="h4">
            Congratulations!!!
          </Typography>
          <Typography className="text-center font-normal">
            Hooray! You've completed the CheckMate program!! Would you like to
            continue with us as a checker?
          </Typography>
        </DialogBody>
        <DialogFooter className="space-x-2">
          <Button variant="text" color="blue-gray" onClick={handleNoContinue}>
            No, I'm good
          </Button>
          <Button
            variant="gradient"
            color="deep-orange"
            onClick={handleContinue}
          >
            Yes!
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
