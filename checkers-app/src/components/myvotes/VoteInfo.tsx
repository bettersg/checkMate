import {
    Typography,
} from "@material-tailwind/react";
import MessageCard from "../common/MessageCard";
import VoteResult from "../myvotes/VoteResult";
import { XMarkIcon } from "@heroicons/react/24/solid";
import CategoryRationalisation from "../myvotes/Rationalisation";
import VotePercentage from "./VotePercentage";

interface PropType {
    id: string,
    text: string,
    primaryCategory: string,
    avgTruthScore: number | null,
    category: string | null,
    truthScore: number | null,
    handleClose: () => void,
    rationalisation: string,
    storageUrl: string | null,
    caption: string | null,
    crowdPercentage: number,
    votedPercentage: number
}

export default function VoteInfoDialog(Prop: PropType) {

    return (
        <div className="grid place-items-center pb-14 top-0 left-0 absolute w-screen h-screen px-2 max-w-screen max-h-screen bg-black bg-opacity-60 backdrop-blur-sm z-40 overscroll-contain"
            onClick={(event) => event.stopPropagation()}>
            <div className="z-50 bg-white dark:bg-dark-component-color p-2 rounded-lg shadow-2xl h-5/6 max-h-5/6 w-full max-w-full overscroll-y-auto overflow-auto" >
                <XMarkIcon className="h-6 w-6 text-gray-500 m-1 hover:text-black" onClick={Prop.handleClose} />
                <div className="w-5/6 mx-auto">
                    <div className="flex flex-col gap-3">
                        <Typography variant="h5" className="text-primary-color3 dark:text-white">Message</Typography>
                        <MessageCard text={Prop.text} storageUrl={Prop.storageUrl} caption={Prop.caption} />
                        <div className='flex w-full gap-x-2'>
                            <div className='flex-1'>
                                <Typography className='text-primary-color3 text-center dark:text-white' variant='h5'>Your vote</Typography>
                                <VoteResult category={Prop.category} truthScore={Prop.truthScore} />
                                <VotePercentage percentage={Prop.votedPercentage} />
                            </div>
                            <div className='flex-1'>
                                <Typography className='text-primary-color3 text-center dark:text-white' variant='h5'>Crowd vote</Typography>
                                <VoteResult category={Prop.primaryCategory} truthScore={Prop.avgTruthScore} />
                                <VotePercentage percentage={Prop.crowdPercentage} />
                            </div>
                        </div>
                        <CategoryRationalisation rationalisation={Prop.rationalisation} />
                    </div>
                </div>
            </div>
        </div>

    );
}
