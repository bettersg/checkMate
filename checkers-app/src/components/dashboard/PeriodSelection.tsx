import { Select, Option } from "@material-tailwind/react";

export default function SelectTimePeriod() {
    return (
        <div className="">
            <Select color="orange" variant="standard" label="Select Time Period">
                <Option>Jan</Option>
                <Option>Feb</Option>
                <Option>Mar</Option>
                <Option>Apr</Option>
                <Option>May</Option>
                <Option>Jun</Option>
                <Option>Jul</Option>
                <Option>Aug</Option>
                <Option>Sep</Option>
                <Option>Oct</Option>
                <Option>Nov</Option>
                <Option>Dec</Option>
            </Select>
        </div>
    )
}