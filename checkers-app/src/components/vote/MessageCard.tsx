import React, { useState } from "react";
import { Card, CardBody, Typography, Button, Alert } from "@material-tailwind/react";
import { ChatBubbleLeftEllipsisIcon, PaperAirplaneIcon } from "@heroicons/react/20/solid";

interface PropType {
  text: string | null;
  type: "image" | "text";
  caption: string | null;
  imageUrl: string | null;
  sender: string | null;
}

// Helper function to detect URLs and split the text
const splitTextByUrls = (text: string) => {
  // This regex will match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  let lastIndex = 0;
  const parts = [];

  // Find all matches and their indices
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    // Push text before URL
    if (index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, index), isUrl: false });
    }

    // Push URL
    parts.push({ text: url, isUrl: true });

    // Update lastIndex to end of current URL
    lastIndex = index + url.length;
  }

  // Push remaining text after last URL
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), isUrl: false });
  }

  return parts;
};

export default function MessageCard(prop: PropType) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lengthBeforeTruncation = 300;
  const { text, caption, imageUrl, type, sender } = prop;

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  let displayText = "";
  if (type === "image") {
    displayText = caption ?? "";
  } else {
    displayText = text ?? "";
  }

  const shouldTruncate = displayText.length > lengthBeforeTruncation;
  const textToShow =
    isExpanded || !shouldTruncate
      ? displayText
      : displayText.slice(0, lengthBeforeTruncation) + "...";

  // Split text by URLs
  const textParts = splitTextByUrls(textToShow);

  return (
    <Card className="bg-error-color overflow-y-auto overflow-x-hidden max-w-md w-full h-full max-h-full p-3">
      <CardBody className="-m-3">
        <Typography className="flex items-center mb-2">
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-[#ff327d] mr-2 flex-shrink-0"/>
          <p className="font-semibold leading-none">Message：</p>
        </Typography>
        <Typography className="w-full">
          {type === "image" && displayText.length > 0 && (
            <span className="font-bold">Caption: </span>
          )}
          {textParts.map((part, index) => {
            // Split the text part by new lines
            const lines = part.text.split("\n");
            return (
              <React.Fragment key={index}>
                {lines.map((line, lineIndex) => (
                  <React.Fragment key={lineIndex}>
                    {part.isUrl ? (
                      <a
                        href={line}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {line}
                      </a>
                    ) : (
                      <span>{line}</span>
                    )}
                    {lineIndex < lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          })}
        </Typography>
        {shouldTruncate && (
          <Button
            onClick={toggleExpansion}
            variant="text"
            className="p-0 text-primary-color3"
            size="sm"
          >
            {isExpanded ? "Show Less" : "Read More"}
          </Button>
        )}

      </CardBody>
      {type === "image" && imageUrl && (
        <img
          src={imageUrl}
          alt="message-image"
          className="w-full object-contain rounded-xl"
        />
      )}
      <CardBody className="-m-3">
      <Typography className="flex items-center mt-1 mb-2">
        <PaperAirplaneIcon className="h-6 w-6 text-[#ff8932] mr-2 flex-srhink-0"/>
        <p className="font-medium leading-none">Sender: {sender}</p>
      </Typography>
      </CardBody>
    </Card>
  );
}
