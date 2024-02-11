import { Spinner } from "@material-tailwind/react";

export default function LoadingPage() {
    return (
        <div className="flex flex-col place-items-center text-bold text-primary-color">
            <h1>Fetching your messages...</h1>
            <Spinner className="h-12 w-12" color="orange" />
        </div>
    )
}