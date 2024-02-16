import { Typography } from "@material-tailwind/react";

interface PropType {
    number: number;
    rank: string
}

export default function AchievementCard(Prop: PropType) {
    return (

        <div className='flex w-full gap-x-2'>
            <div className='flex-1'>
                <div className="grid grid-flow-row justify-items-center rounded-lg shadow-md p-3 bg-error-color dark:bg-dark-component-color text-primary-color">
                    <img src='./calendar.png' className='h-12 w-12' />
                    <Typography className='font-bold'>{Prop.number} day streak</Typography>
                </div>
            </div>
            <div className='flex-1'>
                <div className="grid grid-flow-row justify-items-center rounded-lg shadow-md p-3 bg-error-color dark:bg-dark-component-color text-primary-color">
                    <img src='./plant.png' className='h-12 w-12' />
                    <Typography className='font-bold'>{Prop.rank}</Typography>
                </div>
            </div>
        </div>


    )
}