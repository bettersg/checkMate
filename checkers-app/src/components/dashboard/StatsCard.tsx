import {
    Card,
    CardBody,
    Typography,
} from "@material-tailwind/react";

interface PropType {
    name: string,
    img_src: string,
    stat: string
}


export default function StatCard(Prop: PropType) {
    return (
        <Card className="w-full max-w-full shadow-primary-color/50">
            <CardBody className="flex flex-col place-items-center">
                <img src={Prop.img_src} alt="..." className="w-16 h-16 rounded-full mx-auto mb-4" />
                <Typography variant="h1" className="mb-2 text-primary-color">
                    {Prop.stat}
                </Typography>
                <Typography>
                    {Prop.name}
                </Typography>
            </CardBody>
        </Card>
    );
}