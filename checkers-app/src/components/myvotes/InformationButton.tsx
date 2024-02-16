import {
    IconButton,
    Dialog,
    DialogBody,
    Typography,
    Button
} from "@material-tailwind/react";
import { useState } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface InfoDialogProps {
    open: boolean,
    handleOpen: () => void,
    handleClose: () => void,
}

export function InformationDialog(Prop: InfoDialogProps) {
    return (
        <Dialog open={Prop.open} handler={Prop.handleOpen} className="dark:bg-dark-component-color">
            <XMarkIcon className="h-6 w-6 text-gray-500 m-1" onClick={Prop.handleClose} />
            <Typography variant="h4" className="text-primary-color3 mx-4 dark:text-white">Navigating MyVotes</Typography>
            <DialogBody className="flex flex-col gap-y-2 align-center">
                <Typography variant="h5" className="text-primary-color3 dark:text-white">Pending</Typography>
                <Typography variant="paragraph" className="text-primary-color3 dark:text-white">Messages waiting for your vote.</Typography>
                <Button
                    className="flex rounded-full justify-start text-left gap-3 bg-pending-color text-primary-color3 font-bold"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}>
                    Not voted yet: bolded and yellow
                </Button>

                <Typography variant="h5" className="text-primary-color3 dark:text-white">Voted</Typography>
                <Typography variant="paragraph" className="text-primary-color3 dark:text-white">Messages that you voted.</Typography>
                <Button
                    className="flex rounded-full items-center gap-3 bg-error-color text-primary-color3 font-bold"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}>
                    Unreviewed results: bolded
                </Button>
                <Button
                    className="flex rounded-full items-center gap-3 bg-success-color text-primary-color3 font-normal"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}>
                    Vote matches crowd: green
                </Button>
                <Button
                    className="flex rounded-full items-center gap-3 bg-error-color text-primary-color3 font-normal"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}>
                    Vote differs from crowd: red
                </Button>
                <Button
                    className="flex flex-row rounded-full justify-self-start gap-3 bg-waiting-color text-primary-color3 font-normal"
                    style={{ width: "100%", fontFamily: "Open Sans, sans-serif", textAlign:"start"}}>
                    Can still change vote: grey
                </Button>
                {/* <Typography variant="small" className="self-center">(You can still change your vote!)</Typography> */}
            </DialogBody>
        </Dialog>
    )
}

export default function InformationButton() {
    const [openInfoDialog, setOpenDialog] = useState<boolean>(false);

    return (
        <div>
            <div>
                {openInfoDialog == true && <InformationDialog open={openInfoDialog} handleOpen={()=>setOpenDialog(true)} handleClose={()=>setOpenDialog(false)}/>}
            </div>
            <div className="fixed bottom-20 right-5 z-10">
                <IconButton size="lg" className="rounded-full bg-highlight-color"
                    onClick={()=>setOpenDialog(!openInfoDialog)}>
                    <InformationCircleIcon className="h-8 w-8 text-white" />
                </IconButton>
            </div>
        </div>
    );
}