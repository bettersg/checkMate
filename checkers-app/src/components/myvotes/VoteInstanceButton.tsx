import { Button } from "@material-tailwind/react";

interface PropType {
  Id: number,
  isAssessed: boolean,
  isMatch: boolean,
  handleClick: () => void,
}

export default function VoteInstanceButton(Prop: PropType) {

  const color = !Prop.isAssessed ? "yellow" : Prop.isMatch ? "green" : "red";
  return (
    <div className="items-center col-span-2 mb-2">
      <Button className="rounded-full" color={color} style={{ width: "100%" }} onClick={Prop.handleClick}>
        {!Prop.isAssessed ? "pending" : Prop.isMatch ? "assessed" : "review"}
      </Button>
    </div>
  );
}
