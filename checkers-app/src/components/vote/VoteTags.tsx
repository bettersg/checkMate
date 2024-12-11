import { MultiValue } from "react-select";
import Select from "react-select";

const options = [
  { value: "generated", label: "🤖 AI Generated" },
  { value: "incorrect", label: "❌ Incorrect Usage" },
];

interface VoteTagsProps {
  tags: string[];
  onSelectTag: (tag: string[]) => void;
  onDropdownToggle: (isOpen:boolean) => void; // Pass open/close state to parent
}

const VoteTags: React.FC<VoteTagsProps> = ({ tags, onSelectTag, onDropdownToggle}) => {
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
    <div className="grid grid-flow-row gap-y-4">
      <Select
            className="mb-3 dark:text-black"
            value={selectedOptions}
            onChange={handleSelectionTag}
            options={options}
            isMulti
            isSearchable={false}
            onMenuOpen={() => onDropdownToggle(true)} // Notify parent when dropdown opens
            onMenuClose={() => onDropdownToggle(false)} // Notify parent when dropdown closes
      />
    </div>
  );
};

export default VoteTags;
