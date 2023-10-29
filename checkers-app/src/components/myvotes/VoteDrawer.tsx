import {
    Drawer,
    Typography,
} from "@material-tailwind/react";
import VoteResult from "./VoteResult";
import MessageCard from "../../shared/MessageCard";
import React, { useState } from "react";

interface PropType {
    id: number,
    text: string,
    primaryCategory: string,
    voteRequest: { userid: number, category: string },
    openReview: boolean,
    closeDrawerBottom: () => void,
}

export default function VoteDrawer(Prop: PropType) {
    return (
        <Drawer
            placement="bottom"
            open={Prop.openReview}
            onClose={Prop.closeDrawerBottom}
            className='h-auto'
        >
            <div className="grid grid-flow-row gap-3 m-1">
                <MessageCard id={Prop.id} text={Prop.text} />
                <div className='flex w-full gap-x-2'>
                    <div className='flex-1'>
                        <Typography className='text-primary-color3 text-center' variant='h5'>Your vote</Typography>
                        <VoteResult category={Prop.voteRequest.category} />
                    </div>
                    <div className='flex-1'>
                        <Typography className='text-primary-color3 text-center' variant='h5'>Crowd vote</Typography>
                        <VoteResult category={Prop.primaryCategory} />
                    </div>
                </div>
            </div>
        </Drawer>
    )
}