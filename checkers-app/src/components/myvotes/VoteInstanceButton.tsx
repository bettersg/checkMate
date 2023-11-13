import { Button } from "@material-tailwind/react";

interface PropType {
  title: string,
  category: string | null,
  isAssessed: boolean,
  isMatch: boolean,
  handleClick: () => void,
  primaryCategory: string,
  isView: boolean
}


export default function VoteInstanceButton(Prop: PropType) {

  const color = (!Prop.isAssessed && Prop.category === null) 
  ? "bg-pending-color" 
  : (!Prop.isAssessed && Prop.category !== null) 
  ? "bg-waiting-color" 
  : Prop.isMatch 
  ? "bg-success-color" 
  : "bg-error-color";
  const textStyle = Prop.isView ? "font-normal" : "font-bold"; // Apply font-bold if isView is false

  return (
    <div className="items-center col-span-2 mb-2">
      <Button className={`rounded-full ${color} text-primary-color3 truncate inline-block whitespace-nowrap ${textStyle}`} style={{ width: "100%", }} onClick={Prop.handleClick}>
        {Prop.title}
      </Button>
    </div>
  );
}
