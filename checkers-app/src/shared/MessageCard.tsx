import { Card, CardBody, Typography, Button } from "@material-tailwind/react";
import { useState} from "react";

interface PropType {
  text: string,
  caption: string | null, 
  imageUrl: string | null
}
//pass message data into message card
export default function MessageCard(prop: PropType) {
  const [isExpanded, setIsExpanded] = useState(false);


  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };

  const truncatedText = prop.text.slice(0, 300) + "..."; // Adjust the number of characters to truncate

  return (
    <Card className="bg-error-color overflow-y-auto overflow-x-hidden max-w-md w-full h-full max-h-full p-3">
      <Typography variant="h5" className="text-primary-color3 my-2 mx-2">Message</Typography>
      
        {prop.imageUrl != null && 
        <img
          src={prop.imageUrl}
          alt="message-image"
          className=" w-full object-contain rounded-xl"/>
        }

      <CardBody className="-m-3">
        {prop.caption != null && <Typography className="italic">{prop.caption}</Typography>}
        <Typography className="w-full">
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
