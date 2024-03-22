import { useState } from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
  Typography,
} from "@material-tailwind/react";
import { SparklesIcon } from "@heroicons/react/20/solid";

interface PropType {
  rationalisation: string | null;
}

export default function CategoryRationalisation(Props: PropType) {
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => setOpen(!open);

  return (
    <>
      <Accordion
        open={open}
        className="mb-2 rounded-lg border border-primary-color px-4"
        icon={
          <SparklesIcon className="h-6 w-6 text-primary-color3 dark:text-white" />
        }
      >
        <AccordionHeader
          onClick={() => handleOpen()}
          className="text-primary-color3 border-b-0"
        >
          <Typography
            variant="h5"
            className="text-primary-color3 font-bold dark:text-white"
          >
            AI Analysis
          </Typography>
        </AccordionHeader>
        <AccordionBody className="pt-2 text-black font-normal dark:text-white">
          {Props.rationalisation != null
            ? Props.rationalisation
            : "GenAI rationalisation not available for this message."}
        </AccordionBody>
      </Accordion>
    </>
  );
}
