import { Card, CardBody, Typography } from "@material-tailwind/react";

export default function MessageCard() {
  return (
    <Card className="my-6 w-full">
      <CardBody>
        <Typography variant="h5" color="blue-gray" className="mb-2">
          Message to be checked
        </Typography>
        <Typography>To be replaced with actual content</Typography>
      </CardBody>
    </Card>
  );
}
