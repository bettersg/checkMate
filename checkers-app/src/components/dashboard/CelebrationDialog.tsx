import React from "react";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  Typography,
  IconButton,
  Button,
} from "@material-tailwind/react";
import { completeProgram } from "../../services/api";
import { useUser } from "../../providers/UserContext";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface PropType {
  display: boolean;
  certificateUrl: string | null;
}

export function CelebrationDialog({ display, certificateUrl }: PropType) {
  const [open, setOpen] = React.useState(display);
  const { checkerDetails } = useUser();
  const navigate = useNavigate();
  const handleOpen = () => setOpen(!open);

  const handleBack = async () => {
    if (checkerDetails.checkerId) {
      setOpen(false);
      navigate(0);
    }
  };

  React.useEffect(() => {
    const completeCheckerProgram = async () => {
      if (checkerDetails.checkerId) {
        await completeProgram(checkerDetails.checkerId);
      }
    };

    completeCheckerProgram();
  }, []);

  return (
    <Dialog open={open} handler={handleOpen}>
      <DialogBody divider className="grid place-items-center gap-4">
        <img
          src="/confetti.png"
          alt="Celebration"
          className="w-16 h-16 rounded-full mx-auto mb-4"
        />
        <IconButton
          size="sm"
          variant="text"
          className="!absolute right-3.5 top-3.5 focus:outline-none"
          onClick={handleBack}
        >
          <XMarkIcon className="h-4 w-4 stroke-2" />
        </IconButton>
        <Typography color="red" variant="h4">
          Congratulations!!!
        </Typography>
        <Typography className="text-left font-normal">
          Congratulations! You've successfully completed the CheckMate Checkers
          program. Your certificate is available below.
        </Typography>
        <Typography className="text-left font-normal">
          We'd love for you to continue assessing messages and help others
          navigate the information landscape. 💪
        </Typography>
        <Typography className="text-left font-normal">
          If you'd prefer to stop, simply type /deactivate to the bot at any
          time.
        </Typography>
      </DialogBody>
      <DialogFooter className="flex flex-wrap gap-2 justify-center">
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
