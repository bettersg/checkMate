import { Card, CardBody, Typography } from "@material-tailwind/react";
import { Progress } from "@material-tailwind/react";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import ShareIconButton from "../common/ShareButton";

interface PropType {
  name: string;
  img_src: string;
  current: number;
  target: number;
  isPercentageTarget?: boolean;
  tooltip_header: string;
  tooltip_description: string | React.ReactNode;
  referral_code?: string | null;
}

export default function ProgressCard(Prop: PropType) {
  const progressValue = Prop.isPercentageTarget
    ? parseFloat(Math.min(Prop.current, 100).toFixed(2))
    : parseFloat(Math.min((Prop.current / Prop.target) * 100, 100).toFixed(2));
  const targetPosition = Math.min((Prop.target / 100) * 100, 100);

  const targetString = `${Prop.current} / ${Prop.target}`;

  const barColor = Prop.isPercentageTarget
    ? Prop.current < Prop.target
      ? "red"
      : "green"
    : "orange";

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

          {Prop.isPercentageTarget && (
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="relative w-full pb-5">
                <Typography
                  className="absolute transform -translate-x-1/2 text-primary-color"
                  style={{ left: `${targetPosition}%` }}
                  variant="h6"
                >
                  {`${Prop.target}%`}
                </Typography>
              </div>
            </div>
          )}

          {!Prop.isPercentageTarget && (
            <div className="mb-2 flex items-center justify-between gap-4">
              <Typography className="text-primary-color" variant="h6">
                {Prop.current / Prop.target < 0.75
                  ? "Some way to go..."
                  : Prop.current / Prop.target < 1
                  ? "Almost there..."
                  : "Completed ✅"}
              </Typography>
              <Typography className="text-primary-color" variant="h6">
                {targetString}
              </Typography>
            </div>
          )}

          <div className="relative w-full">
            <Progress
              value={progressValue}
              color={barColor}
              className="relative z-10"
              size="lg"
              label={Prop.isPercentageTarget}
            />
            {/* Vertical Line */}
            {Prop.isPercentageTarget && (
              <div
                className="absolute top-0 left-0 h-full border-l-4 border-primary-color z-20"
                style={{ left: `${targetPosition - 1}%` }}
              ></div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
