import {
    Typography,
} from "@material-tailwind/react";
import MessageCard from "../../shared/MessageCard";
import VoteResult from "../myvotes/VoteResult";
import { XMarkIcon } from "@heroicons/react/24/solid";
import CategoryRationalisation from "../myvotes/Rationalisation";

interface PropType {
    id: string,
    text: string,
    primaryCategory: string,
    category: string | null,
    handleClose: () => void,
    rationalisation: string
}

export default function VoteInfoDialog(Prop: PropType) {
    return (
        <div className="grid place-items-center pb-14 top-0 left-0 absolute w-screen h-screen px-2 max-w-screen max-h-screen bg-black bg-opacity-60 backdrop-blur-sm z-0 overscroll-contain" >
            <div className="z-50 bg-white p-2 rounded-lg shadow-2xl h-5/6 max-h-5/6 w-full max-w-full overscroll-y-auto overflow-auto" >
                <XMarkIcon className="h-6 w-6 text-gray-500 m-1" onClick={Prop.handleClose} />
                <div className="w-5/6 mx-auto">
                    <div className="flex flex-col gap-3">
                        <MessageCard text={Prop.text} />
                        <div className='flex w-full gap-x-2'>
                            <div className='flex-1'>
                                <Typography className='text-primary-color3 text-center' variant='h5'>Your vote</Typography>
                                <VoteResult category={Prop.category} />
                            </div>
                            <div className='flex-1'>
                                <Typography className='text-primary-color3 text-center' variant='h5'>Crowd vote</Typography>
                                <VoteResult category={Prop.primaryCategory} />
                            </div>
                        </div>
                        <CategoryRationalisation rationalisation={Prop.rationalisation} />

                    </div>
                </div>
            </div>
        </div>

    );
}
