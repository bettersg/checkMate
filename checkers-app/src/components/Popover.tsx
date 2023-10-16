import {
  Popover,
  PopoverHandler,
  PopoverContent,
  Button,
} from "@material-tailwind/react";

export default function PopoverDefault() {
  return (
    <div className="left-0 p-4 flex m-2">
      <Popover placement="right">
        <PopoverHandler>
          <Button style={{ backgroundColor: "#00a8b1" }}>Dashboard</Button>
        </PopoverHandler>
        <PopoverContent>View voting statistics</PopoverContent>
      </Popover>
    </div>
  );
}
