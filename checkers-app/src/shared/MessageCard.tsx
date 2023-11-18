import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { useState } from "react";

interface PropType {
  text: string,
}
//pass message data into message card
export default function MessageCard(prop: PropType) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedText = prop.text.slice(0, 300) + "..."; // Adjust the number of characters to truncate

  return (
    <Card className="bg-error-color overflow-scroll max-w-md w-full h-full max-h-full overflow-x-hidden">
      <CardBody>
        <Typography variant="h5" className="text-primary-color3">Message Text</Typography>
        <Typography >
          {prop.text.length <= 300 ? prop.text : isExpanded ? prop.text : truncatedText}
        </Typography>
        {prop.text.length > 300 && !isExpanded ? (
          <Button onClick={toggleExpansion} variant="text" className="p-0 text-primary-color3" size="sm">
            Read More
          </Button>
        ) : prop.text.length > 300 && isExpanded ? <Button onClick={toggleExpansion} variant="text" className="p-0 text-primary-color3" size="sm">
          Show Less
        </Button>
          : null}
      </CardBody>
    </Card>
  );
}
