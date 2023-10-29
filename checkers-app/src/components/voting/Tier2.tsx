import { Slider, Typography } from "@material-tailwind/react";

export default function VeracitySlider() {
  return (
    <div className="grid grid-flow-row w-full max-w-md gap-2 mb-4">
      <Typography className="text-primary-color3">
        Please assess the veracity of the claim(s) in the message on a scale
        from 0 (entirely false) to 5 (entirely true).
      </Typography>
      <Slider
        defaultValue={0}
        barClassName="rounded bg-[#ff8932] value"
        thumbClassName="[&::-moz-range-thumb]:rounded [&::-webkit-slider-thumb]:rounded [&::-moz-range-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:-mt-[4px]"
        trackClassName="[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent rounded !bg-[#ff8932]/10 border border-[#ff8932]/20"
      />
    </div>
  );
}
