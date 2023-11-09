import { Button } from "@material-tailwind/react";

interface PropType {
  id: number,
  isAssessed: boolean,
  isMatch: boolean,
  handleClick: () => void,

}


export default function VoteInstanceButton(Prop: PropType) {

  const color = !Prop.isAssessed ? "bg-pending-color" : Prop.isMatch ? "bg-success-color" : "bg-error-color";
  return (
    <div className="items-center col-span-2 mb-2">
      <Button className={`rounded-full ${color} text-primary-color3`} style={{ width: "100%",}} onClick={Prop.handleClick}>
        {!Prop.isAssessed ? "pending" : Prop.isMatch ? "correct" : "review"}
      </Button>
    </div>
  );
}
