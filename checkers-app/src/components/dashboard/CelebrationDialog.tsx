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
  certificateUrl: string | null;
}

export function CelebrationDialog({ display, certificateUrl }: PropType) {
  const [open, setOpen] = React.useState(display);
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

  React.useEffect(() => {
    console.log("Certificate URL in CelebrationDialog:", certificateUrl);
    setOpen(display); // Ensure open state is updated when display prop changes
  }, [display, certificateUrl]);

  return (
    <Dialog open={open} handler={handleOpen}>
      <DialogBody divider className="grid place-items-center gap-4">
        <img
          src="/confetti.png"
          alt="Celebration"
          className="w-16 h-16 rounded-full mx-auto mb-4"
        />
        <Typography color="red" variant="h4">
          Congratulations!!!
        </Typography>
        <Typography className="text-center font-normal">
          Hooray! You've completed the CheckMate program!! We'd love for you to
          stay on as a checker and help us in our fight against misinformation
          and scams. Would you like to stay on?
        </Typography>
      </DialogBody>
      <DialogFooter className="space-x-2">
        <Button variant="text" color="blue-gray" onClick={handleNoContinue}>
          No, I'm good
        </Button>
        <Button variant="gradient" color="deep-orange" onClick={handleContinue}>
          Yes!
        </Button>
        {certificateUrl && (
          <Button
            variant="gradient"
            color="green"
            onClick={() => window.open(certificateUrl, "_blank")}
          >
            View Certificate
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
