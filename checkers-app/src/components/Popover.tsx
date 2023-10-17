import {
  Popover,
  PopoverHandler,
  PopoverContent,
  Button,
} from "@material-tailwind/react";

export default function PopoverDefault({ props }) {
  return (
    <div className="left-0 p-2 flex">
      <Popover placement="right">
        <PopoverHandler>
          <Button style={{ backgroundColor: "#00a8b1" }}>{props.title}</Button>
        </PopoverHandler>
        <PopoverContent>{props.info}</PopoverContent>
      </Popover>
    </div>
  );
}
