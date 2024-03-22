import { Card, CardBody, Typography } from "@material-tailwind/react";

interface PropType {
  name: string;
  img_src: string;
  stat: string;
}

export default function StatCard(Prop: PropType) {
  return (
    <Card className="dark:bg-dark-component-color dark:shadow-dark-component-color/20">
      <CardBody className="flex flex-col place-items-center">
        <img
          src={Prop.img_src}
          alt="..."
          className="w-16 h-16 rounded-full mx-auto mb-4"
        />
        <Typography variant="h1" className="mb-2 text-primary-color">
          {Prop.stat}
        </Typography>
        <Typography className="text-dark-component-color dark:text-white">
          {Prop.name}
        </Typography>
      </CardBody>
    </Card>
  );
}
