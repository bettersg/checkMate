import { Typography } from "@material-tailwind/react"
import { Progress } from "@material-tailwind/react";


interface BadgeType {
    name: string,
    icon: string,
    description: string,
    status: number

}

export default function Badge(Props: BadgeType) {
    return (
        <div className='w-full my-2 '>
            <div className="flex flew-row rounded-lg shadow-md gap-x-2 p-5 border-error-color border-2 text-primary-color3">
                <div className="flex flex-col basis-1/3 flex-1 justify-center items-center rounded-lg shadow-lg bg-secondary-color p-1">
                    <img src={Props.icon} className='object-contain p-2' />
                </div>
                <div className='flex flex-col flex-1 basis-2/3 justify-center items-start'>
                    <Typography variant='h4'>{Props.name}</Typography>
                    <Typography>{Props.description}</Typography>
                    <Progress value={Props.status} color='teal' />
                </div>
            </div>
        </div>
    )
}