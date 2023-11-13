import {
    Dialog,
    DialogBody,
    Typography,
    Card,
    CardBody
} from "@material-tailwind/react";
import MessageCard from "../../shared/MessageCard";
import VoteResult from "./VoteResult";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface PropType {
    id: string,
    open: boolean,
    text: string,
    primaryCategory: string,
    category: string | null,
    handleOpen: () => void,
    justification: string
}

export function VoteInfoDialog(Prop: PropType) {

    return (
        <>
            <Dialog
                open={Prop.open}
                size={"md"}
                handler={Prop.handleOpen}
            >
                <XMarkIcon className="h-6 w-6 text-gray-500 m-3" onClick={Prop.handleOpen} />
                <DialogBody className="overflow-scroll">
                    <div className="grid grid-flow-row gap-3 m-1">
                        <MessageCard id={Prop.id} text={Prop.text} />
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
                        <Card className="my-6 w-full bg-error-color">
                            <CardBody>
                                <Typography variant='h5'>How do we know?</Typography>
                                <Typography>{Prop.justification}</Typography>
                            </CardBody>
                        </Card>
                    </div>
                </DialogBody>
            </Dialog >
        </>
    );
}
