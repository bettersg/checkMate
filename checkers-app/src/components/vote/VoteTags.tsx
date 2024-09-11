import { Typography } from "@material-tailwind/react";
import { useState } from "react";
import { useEffect } from "react";
import Select, {MultiValue} from "react-select"


const options = [
    { value: "generated", label: "🤖 AI Generated" },
    // { value: "incorrect", label: "❌ Incorrect" },
  ];

interface VoteTagsProps {
    tags: string[],
    onSelectTag: (tag: string[]) => void,
}

const VoteTags: React.FC<VoteTagsProps> = ({tags, onSelectTag}) => {
    const [selectedOption, setSelectedOption] = useState<MultiValue<{value: string; label: string}> | null>(null)

    useEffect(() => {
        const fetchVote = async () => {
            // want to set the selected options 
            if (tags) {
                const mappedTags = tags.map(tag => options.find(option => option.value === tag))
                                       .filter(option => option !== undefined);
                setSelectedOption(mappedTags)
            }
        }
        fetchVote()
    }, [])

    // Handle the selection of Tags
    const handleSelectionTag = (tagOption: MultiValue<{value: string; label: string}> | null) => {
        setSelectedOption(tagOption)
        const newtags = tagOption?.map(tag => tag.value)
        if (newtags){
            onSelectTag(newtags)
        } else {
            onSelectTag([])
        }
    }

    return (
        <div className = "grid grid-flow-row gap-y-4 items-center">
            <Typography
                        variant="h4"
                        className="text-primary-color3 dark:text-white"
                        >
                        Select tags:
            </Typography>
            <Select
                className = "mb-3"
                defaultValue = {selectedOption}
                onChange = {handleSelectionTag}
                options = {options}
                isMulti/>
        </div>
    )
}

export default VoteTags