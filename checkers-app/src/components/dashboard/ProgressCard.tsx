import { Card, CardBody, Typography } from "@material-tailwind/react";
import { Progress } from "@material-tailwind/react";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import ShareIconButton from "../common/ShareButton";

interface PropType {
  name: string;
  img_src: string;
  current: number;
  target: number;
  tooltip_header: string;
  tooltip_description: string | React.ReactNode;
  referral_code?: string | null;
}

export default function ProgressCard(Prop: PropType) {
  return (
    <Card className="dark:bg-dark-component-color dark:shadow-dark-component-color/20">
      <CardBody className="flex flex-col place-items-center">
        <img
          src={Prop.img_src}
          alt="..."
          className="w-16 h-16 rounded-full mx-auto mb-4"
        />
        <div className="w-full text-center">
          <div className="flex justify-center items-center space-x-2">
            <Typography className="text-dark-component-color dark:text-white">
              {Prop.name}
            </Typography>
            <TooltipWithHelperIcon
              header={Prop.tooltip_header}
              text={Prop.tooltip_description}
            />
            {Prop.referral_code && (
              <ShareIconButton
                referral_link={`https://ref.checkmate.sg/${Prop.referral_code}`}
              />
            )}
          </div>

          <div className="mb-2 flex items-center justify-between gap-4">
            <Typography className="text-primary-color" variant="h6">
              {Prop.current / Prop.target < 0.75
                ? "Some way to go..."
                : Prop.current / Prop.target < 1
                ? "Almost there..."
                : "Completed ✅"}
            </Typography>
            <Typography className="text-primary-color" variant="h6">
              {Prop.current} / {Prop.target}
            </Typography>
          </div>
          <Progress
            value={Math.min((Prop.current / Prop.target) * 100, 100)}
            color="orange"
          />
        </div>
      </CardBody>
    </Card>
  );
}
