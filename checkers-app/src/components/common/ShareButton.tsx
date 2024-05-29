import React from "react";
import { useNavigate } from "react-router-dom";
import { ShareIcon } from "@heroicons/react/20/solid";

interface PropType {
  referral_link: string;
}

const ShareIconButton = (Props: PropType) => {
  const navigate = useNavigate();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Share CheckMate",
          text: `Have you started checking and reporting suspicious messages using CheckMate yet? Sign up by clicking this link and sending in the pre-loaded message!! ${Props.referral_link}`,
        });
        console.log("Content shared successfully");
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      alert("Web Share API is not supported in your browser.");
    }
  };

  return (
    <ShareIcon
      onClick={handleShare}
      className="h-6 w-6 text-blue-500 cursor-pointer"
    />
  );
};

export default ShareIconButton;
