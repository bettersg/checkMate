import { Button } from "@material-tailwind/react";
import {
    Accordion,
    AccordionHeader,
    AccordionBody,
  } from "@material-tailwind/react";
  import { Typography } from "@material-tailwind/react";

import { useState } from "react";
import { ComputerDesktopIcon } from "@heroicons/react/20/solid";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import { useEffect } from "react";

interface IconProps {
    id: Number, 
    open: Number
}

const Icon: React.FC<IconProps> = ({ id, open }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className={`${id === open ? "rotate-180" : ""} h-5 w-5 transition-transform`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    );
  }

const TAGS = [
    {
        name: "generated",
        icon: <ComputerDesktopIcon className = "h-7 w-7" />,
        display: "AI Generated",
        description: "Content is AI Generated."
    },
    // {
    //     name: "incorrect",
    //     icon: <ComputerDesktopIcon className = "h-7 w-7" />,
    //     display: "Incorrect",
    //     description: "Content is AI Generated."
    // }
]

interface VoteTagsProps {
    tags: string[],
    onSelectTag: (tag: string) => void,
    onRemoveTag: (tag: string) => void
}

const VoteTags: React.FC<VoteTagsProps> = ({tags, onSelectTag, onRemoveTag}) => {
    const [selectedTagOptions, setSelectedTagOptions] = useState<string[]>([]);

    useEffect(() => {
        const fetchVote = async () => {
            setSelectedTagOptions(tags)
        }
        fetchVote()
    }, [])

    // Add Tag
    const handleSelectTagOption = (tagName: string | null) => {
        if(tagName) {
            setSelectedTagOptions((prevTags) => [...prevTags, tagName])
            onSelectTag(tagName)
        }
    }

    // Remove Tag
    const handleRemoveTagOption = (tagName: string) => {
        setSelectedTagOptions((prevTags) => prevTags.filter((tag) => tag !== tagName));
        onRemoveTag(tagName)
    }

    // Check if the Tag is found
    const checkTagInSelection = (tagName: string) => {
        if(selectedTagOptions.includes(tagName)) {
            return true
        } else {
            return false
        }
    }

    // Variables for the Accordian
    const [open, setOpen] = useState<Number>(0);
    const handleOpen = (value: Number) => setOpen(open === value ? 0 : value);

    return (
        <div className = "grid grid-flow-row gap-y-4 items-center">
            <Accordion open={open === 1} icon={<Icon id={1} open={open} />}>
                <AccordionHeader onClick={() => handleOpen(1)}>
                    <Typography
                        variant="h4"
                        className="text-primary-color3 dark:text-white"
                        >
                        Select tags:
                    </Typography>
                </AccordionHeader>
                <AccordionBody className = "grid grid-flow-row gap-y-4">
                    {TAGS.map((tag, index) => (
                        <>
                        {checkTagInSelection(tag.name) === true ? 
                        <Button
                        className = "flex flex-row items-center justify-start gap-2 w-full space-x-3 text-sm bg-primary-color3"
                        key = {index}
                        onClick = {() => handleRemoveTagOption(tag.name)}
                        >
                            {tag.icon}
                            {tag.display}
                            <TooltipWithHelperIcon
                            header={tag.display}
                            text={tag.description}
                            />
                    </Button> : <Button
                        className = 'flex flex-row items-center justify-start gap-2 w-full space-x-3 text-sm bg-primary-color'
                        key = {index}
                        onClick = {() => handleSelectTagOption(tag.name)}
                        >
                            {tag.icon}
                            {tag.display}
                            <TooltipWithHelperIcon
                            header={tag.display}
                            text={tag.description}
                            />
                    </Button>
                        }
                        
                        </>
                    ))}
                </AccordionBody>
            </Accordion>
        </div>
    )
}

export default VoteTags