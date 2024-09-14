import { Typography } from "@material-tailwind/react";
import { MultiValue } from "react-select";
import Select from "react-select";

const options = [
  { value: "generated", label: "🤖 AI Generated" },
  { value: "incorrect", label: "❌ Incorrect" },
];

interface VoteTagsProps {
  tags: string[];
  onSelectTag: (tag: string[]) => void;
}

const VoteTags: React.FC<VoteTagsProps> = ({ tags, onSelectTag }) => {
  const selectedOptions = tags
    .map((tag) => options.find((option) => option.value === tag))
    .filter(
      (option): option is { value: string; label: string } =>
        option !== undefined
    );

  const handleSelectionTag = (
    tagOption: MultiValue<{ value: string; label: string }> | null
  ) => {
    const newTags = tagOption ? tagOption.map((tag) => tag.value) : [];
    onSelectTag(newTags);
  };

  return (
    <div className="grid grid-flow-row gap-y-4 items-center">
      <Typography variant="h4" className="text-primary-color3 dark:text-white">
        Select tags:
      </Typography>
      <Select
        className="mb-3"
        value={selectedOptions}
        onChange={handleSelectionTag}
        options={options}
        isMulti
      />
    </div>
  );
};

export default VoteTags;
