import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { useState } from "react";

interface PropType {
  text: string;
  caption: string | null;
  storageUrl: string | null;
}

// Pass message data into message card
export default function MessageCard(prop: PropType) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedText = prop.text.slice(0, 300) + "..."; // Adjust the number of characters to truncate
  
  return (
    <Card className="bg-error-color overflow-y-auto overflow-x-hidden max-w-md w-full h-full max-h-full p-3">
      {prop.storageUrl && (
        <img
          src={prop.storageUrl} // Use downloaded URL here
          alt="message-image"
          className=" w-full object-contain rounded-xl"
        />
      )}

      <CardBody className="-m-3">
        {prop.caption != null && <Typography className="italic text-primary-color3">{prop.caption}</Typography>}
        <Typography className="w-full text-balance text-primary-color3 break-words">
          {prop.text.length <= 300 ? prop.text : isExpanded ? prop.text : truncatedText}
        </Typography>
        {prop.text.length > 300 ? (
          <Button onClick={toggleExpansion} variant="text" className="p-0 text-primary-color3 underline" size="sm">
            {isExpanded ? "Show Less" : "Read More"}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}