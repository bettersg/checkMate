import React, { useState, useEffect } from "react";
import { Alert } from "@material-tailwind/react";
import { useNavigate } from "react-router-dom";
import {
  getMessage,
  postCustomReply,
  sendWhatsappTestMessage,
} from "../../services/api";
import { useUser } from "../../providers/UserContext";

interface PropType {
  messageId: string | undefined;
}

export default function CustomReply(Prop: PropType) {
  //load props
  const navigate = useNavigate();
  const { messageId } = Prop;
  const { checkerDetails } = useUser();
  const [customReplyText, setCustomReplyText] = useState("");
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    const fetchMessage = async () => {
      if (messageId) {
        const message = await getMessage(messageId);
        if (message.customReply) {
          setCustomReplyText(message?.customReply?.text ?? "");
        } else {
          setCustomReplyText("");
        }
      }
    };
    if (messageId) {
      fetchMessage();
    }
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomReplyText(event.target.value);
  };

  const handleSubmit = () => {
    // Implement what happens when the comment is posted (e.g., send to a server)
    if (checkerDetails.checkerId && customReplyText && messageId) {
      postCustomReply(
        messageId,
        checkerDetails.checkerId,
        customReplyText
      ).then(() => {
        navigate("/votes");
      });
    }
  };

  const handleWhatsappTest = () => {
    if (checkerDetails.checkerId && customReplyText) {
      sendWhatsappTestMessage(checkerDetails.checkerId, customReplyText)
        .then((data) => {
          setShowAlerts(false);
        })
        .catch((error) => {
          console.error(error);
          setShowAlerts(true);
        });
    }
  };

  return (
    <div className="relative w-full md:w-[32rem]">
      <div className="relative w-full min-w-[200px]">
        <textarea
          rows={8}
          value={customReplyText}
          onChange={handleInputChange}
          className="peer h-full min-h-[100px] w-full resize-none rounded-[7px] border border-blue-gray-200 border-t-transparent bg-transparent px-3 py-2.5 font-sans text-sm font-normal text-blue-gray-700 outline outline-0 transition-all placeholder-shown:border placeholder-shown:border-blue-gray-200 placeholder-shown:border-t-blue-gray-200 focus:border-2 focus:border-gray-900 focus:border-t-transparent focus:outline-0"
          placeholder=" "
        />
        <label className="before:content[' '] after:content[' '] pointer-events-none absolute left-0 -top-1.5 flex h-full w-full select-none text-[11px] font-normal leading-tight text-blue-gray-400 transition-all before:pointer-events-none before:mt-[6.5px] before:mr-1 before:box-border before:block before:h-1.5 before:w-2.5 before:rounded-tl-md before:border-t before:border-l before:border-blue-gray-200 before:transition-all after:pointer-events-none after:mt-[6.5px] after:ml-1 after:box-border after:block after:h-1.5 after:w-2.5 after:flex-grow after:rounded-tr-md after:border-t after:border-r after:border-blue-gray-200 after:transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:leading-[3.75] peer-placeholder-shown:text-blue-gray-500 peer-placeholder-shown:before:border-transparent peer-placeholder-shown:after:border-transparent peer-focus:text-[11px] peer-focus:leading-tight peer-focus:text-gray-900 peer-focus:before:border-t-2 peer-focus:before:border-l-2 peer-focus:before:!border-gray-900 peer-focus:after:border-t-2 peer-focus:after:border-r-2 peer-focus:after:!border-gray-900">
          Custom Reply
        </label>
      </div>
      <div className="flex w-full justify-between py-1.5">
        <button
          className="relative h-8 max-h-[32px] w-8 max-w-[32px] select-none rounded-lg text-center align-middle font-sans text-xs font-medium uppercase text-blue-gray-500 transition-all hover:bg-blue-gray-500/10 active:bg-blue-gray-500/30"
          type="button"
        >
          {/* SVG here */}
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleWhatsappTest}
            className="px-4 py-2 font-sans text-xs font-bold text-center text-gray-900 uppercase align-middle transition-all rounded-md select-none hover:bg-gray-900/10 active:bg-gray-900/20"
            type="button"
          >
            Test on WhatsApp
          </button>
          <button
            onClick={handleSubmit}
            className="select-none rounded-md bg-gray-900 py-2 px-4 text-center align-middle font-sans text-xs font-bold uppercase text-white shadow-md shadow-gray-900/10 transition-all hover:shadow-lg hover:shadow-gray-900/20 focus:opacity-[0.85] focus:shadow-none active:opacity-[0.85] active:shadow-none"
            type="button"
          >
            Submit Custom Reply
          </button>
        </div>
        {showAlerts && (
          <Alert
            color="amber"
            open={showAlerts}
            onClose={() => setShowAlerts(false)}
          >
            A dismissible alert for showing message.
          </Alert>
        )}
      </div>
    </div>
  );
}
