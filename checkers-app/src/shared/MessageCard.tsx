import { Card, CardBody, Typography } from "@material-tailwind/react";

interface PropType {
  id: string,
  text: string,
}
//pass message data into message card
export default function MessageCard(prop: PropType) {
  return (
    <Card className="my-6 w-full bg-error-color">
      <CardBody>
        <Typography variant="h5" color="blue-gray" className="mb-2">
          {prop.id}
        </Typography>
        <Typography>{prop.text}</Typography>
      </CardBody>
    </Card>
  );
}
