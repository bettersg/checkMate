import React, { useState } from "react";
import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { UserIcon, LinkIcon } from "@heroicons/react/24/solid";

interface PropType {
  en: string;
  cn: string;
  links: string[];
  downvoted: boolean;
}

// Helper function to detect URLs and split the text
const splitTextByUrls = (text: string) => {
  // This regex will match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let match;
  let lastIndex = 0;
  const parts = [];

  // Find al matches and their indices
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

export default function CommunityNoteCard(prop: PropType) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lengthBeforeTruncation = 300;
  const { en, links } = prop;

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  let displayText = en ?? "";

  const shouldTruncate = displayText.length > lengthBeforeTruncation;
  const textToShow =
    isExpanded || !shouldTruncate
      ? displayText
      : displayText.slice(0, lengthBeforeTruncation) + "...";

  // Split text by URLs
  const textParts = splitTextByUrls(textToShow);

  return (
    <Card className="bg-blue-100 overflow-y-auto overflow-x-hidden max-w-md w-full h-full max-h-full p-3 mb-2 mt-3">
      <CardBody className="-m-3">
        <Typography className="flex items-center mb-2">
          <UserIcon className="h-6 w-6 text-[#ff8932] mr-2 flex-shrink-0" />
          <p className="font-semibold leading-none">Community Note</p>
        </Typography>

        <Typography className="w-full">
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

        {links.length > 0 ? (
          <>
            <Typography className="pt-4">
              <p className="font-semibold leading-none">Reference Links:</p>
            </Typography>
            <ul className="list-disc pt-1">
              {links.map((link) => {
                return (
                  <li className="flex gap-x-2">
                    <LinkIcon
                      aria-hidden="true"
                      className="h-6 w-5 flex-none"
                    />
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {link}
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
