import { Button } from "@material-tailwind/react";
import { Timestamp } from "firebase/firestore";
import { ClockIcon } from "@heroicons/react/20/solid";

interface PropType {
  title: string,
  category: string | null,
  isAssessed: boolean,
  isMatch: boolean,
  handleClick: () => void,
  primaryCategory: string,
  isView: boolean
  firstTimestamp: Timestamp | null
}


export default function VoteInstanceButton(Prop: PropType) {

  const color = (Prop.category === null || !Prop.isAssessed)
    ? "bg-pending-color"
    : Prop.isMatch
      ? "bg-success-color"
      : "bg-error-color";
  const textStyle = Prop.isView ? "font-normal" : "font-bold"; // Apply font-bold if isView is false

  return (
    <div className="items-center col-span-2 mb-2">
      <Button
        className={`flex rounded-full items-center gap-3 ${color} text-primary-color3 truncate inline-block whitespace-nowrap overflow-hidden ${textStyle}`}
        style={{ width: "100%", fontFamily: "Open Sans, sans-serif" }}
        onClick={Prop.handleClick}>
        {/* {(!Prop.isAssessed && Prop.category !== null) && <ClockIcon className="h-5 w-5 text-gray-500" />} */}
        {Prop.title}
      </Button>
    </div >
  );
}
