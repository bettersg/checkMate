import { Typography } from "@material-tailwind/react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { ShieldExclamationIcon } from "@heroicons/react/24/solid";
import { LightBulbIcon } from "@heroicons/react/24/solid";
import { FaceFrownIcon } from "@heroicons/react/24/solid";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { HandThumbUpIcon } from "@heroicons/react/20/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/20/solid";

interface PropType {
    category: string | null,
}

export default function VoteResult(Prop: PropType) {
    const catIcon = () => {
        switch (Prop.category) {
            case 'Scam':
                return <XMarkIcon className="h-7 w-7" />;
            case 'Illicit':
                return <ShieldExclamationIcon className="h-7 w-7" />;
            case 'News/Info/Opinion':
                return <LightBulbIcon className="h-7 w-7" />;
            case 'Spam':
                return <FaceFrownIcon className="h-7 w-7" />;
            case 'Trivial':
                return <CheckCircleIcon className="h-7 w-7" />;
            case 'Unsure':
                return <QuestionMarkCircleIcon className="h-7 w-7" />;
            case 'Legitimate':
                 return <HandThumbUpIcon className="h-7 w-7" />;
            default:
                return null;
        }
    };
    return (
        <div className="grid grid-flow-row justify-items-center rounded-lg shadow-md p-3 bg-primary-color text-background-color">
            {catIcon()}
            <Typography>{Prop.category}</Typography>
        </div>
    )
}