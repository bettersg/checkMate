// src/components/InactiveUserModal.tsx
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Button,
} from "@material-tailwind/react";
import { useUser } from "../../providers/UserContext";
import { activateChecker } from "../../services/api";

interface ReactivationDialogProps {
  open: boolean;
  onClose: () => void;
  onActivation: () => void;
}

export function ReactivationDialog({
  open,
  onClose,
  onActivation,
}: ReactivationDialogProps) {
  const navigate = useNavigate();
  const { checkerDetails, setCheckerDetails } = useUser();

  const handleCancel = () => {
    onClose();
    setCheckerDetails((prev) => ({
      ...prev,
      isAgainstReactivating: true,
    }));
    navigate("/");
  };

  const handleReactivation = async () => {
    try {
      if (checkerDetails.checkerId) {
        await activateChecker(checkerDetails.checkerId);
      }
      onActivation();
      onClose();
    } catch (error) {
      console.error("Failed to reactivate:", error);
    }
  };

  return (
    <Dialog open={open} handler={onClose} size="xs">
      <DialogHeader>Welcome Back!</DialogHeader>
      <DialogBody divider className="space-y-4">
        <p>Your account is currently inactive. We'd love to have you back!</p>
        <p className="space-y-2">
          By reactivating your account, you'll:
          <ul className="list-disc pl-6 pt-2 space-y-1">
            <li>Continue your checking journey</li>
            <li>Receive new messages to vote on</li>
            <li>Be able to view the leaderboard</li>
          </ul>
        </p>
        <p>Hit the button to get reactivated now!</p>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="text"
          color="red"
          className="border-none"
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button variant="gradient" color="green" onClick={handleReactivation}>
          Reactivate
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
