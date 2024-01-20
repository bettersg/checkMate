import { Typography } from "@material-tailwind/react";

interface PropType {
    children: React.ReactNode;
}

export default function PageHeader(props: PropType) {
    return (
        <div className="flex mb-4">
            <div className="bg-highlight-color pl-4 pr-4 pt-2 pb-2 rounded-md">
                <Typography variant="h6" className="text-background-color">{props.children}</Typography>
            </div>
        </div>
    );
}