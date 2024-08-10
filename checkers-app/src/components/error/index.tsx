import { Typography, Button } from "@material-tailwind/react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";

export function ErrorSplashPage({
  header = "Error 404",
  description = "",
  details = "Don't worry, our team is already on it. Please try refreshing the page or come back later.",
  buttonText = "Back Home",
  IconComponent = ExclamationCircleIcon,
  onButtonClick = null,
}) {
  return (
    <div className="h-screen mx-auto grid place-items-center text-center px-8">
      <div>
        <IconComponent className="w-16 h-16 mx-auto" />
        <Typography
          variant="h1"
          color="blue-gray"
          className="mt-10 !text-3xl !leading-snug md:!text-4xl"
        >
          {header} <br /> {description}
        </Typography>
        <Typography className="mt-8 mb-14 text-[18px] font-normal text-gray-500 mx-auto md:max-w-sm">
          {details}
        </Typography>
        {
          // If onButtonClick is not provided, do not render the button
          onButtonClick && (
            <Button
              color="gray"
              className="w-full px-4 md:w-[8rem]"
              onClick={onButtonClick}
            >
              {buttonText}
            </Button>
          )
        }
      </div>
    </div>
  );
}

export default ErrorSplashPage;
