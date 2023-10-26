import {
  Popover,
  PopoverHandler,
  PopoverContent,
  Button,
} from "@material-tailwind/react";

interface PropType {
  title: string;
  info: string;
}

export default function PopoverDefault(props: PropType) {
  return (
    <div className="left-0 p-2 flex mb-4">
      <Popover placement="right">
        <PopoverHandler>
          <Button style={{ backgroundColor: "#00a8b1" }}>{props.title}</Button>
        </PopoverHandler>
        <PopoverContent>{props.info}</PopoverContent>
      </Popover>
    </div>
  );
}
