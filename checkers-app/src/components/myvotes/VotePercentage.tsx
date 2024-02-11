import { Rating} from "@material-tailwind/react";
import { UserIcon as RatedIcon } from "@heroicons/react/20/solid";
import { UserIcon as UnratedIcon } from "@heroicons/react/24/outline";


interface PropType {
    percentage: number;
}

export default function VotePercentage(Prop: PropType) {
    return (
        <div className="flex items-center gap-2 font-bold text-sm text-primary-color3 my-2">
                {Prop.percentage}%
            <Rating
                value={Math.round((Prop.percentage) * 5 / 100)}
                ratedIcon={<RatedIcon className="h-5 w-5 text-primary-color" />}
                unratedIcon={<UnratedIcon className="h-5 w-5 text-primary-color" />}
                readonly
            />
        </div>
    );
}