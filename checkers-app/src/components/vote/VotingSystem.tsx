import { useState } from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
  Typography,
  Button,
} from "@material-tailwind/react";
import VoteCategories from "./VoteCategories";
import CommunityNoteCategories from "./CommunityNoteCategories";
import { ForwardIcon } from "@heroicons/react/24/solid";
import VoteTags from "./VoteTags";
import { TooltipWithHelperIcon } from "../common/ToolTip";
import { CommunityNote } from "../../../../functions/src/types";
import DoneButton from "./DoneButton";

interface PropType {
  messageId: string | null;
  voteRequestId: string | null;
  currentCategory: string | null;
  currentTruthScore: number | null;
  currentTags: string[] | null;
  numberPointScale: number;
  currentCommunityNoteCategory: string | null;
  communityNote: CommunityNote;
  commentOnNote: string | null;
  isTester: boolean | null;
}

interface IconProps {
  id: number;
  open: number | undefined;
}

function Icon({ id, open }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`${
        id === open ? "rotate-180" : ""
      } h-5 w-5 transition-transform`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

export default function VotingSystem(Prop: PropType) {
  const [open, setOpen] = useState([1]);

  const currentCategory = Prop.currentCategory;
  const currentTruthScore = Prop.currentTruthScore;
  const currentTags = Prop.currentTags ?? [];
  const messageId = Prop.messageId;
  const voteRequestId = Prop.voteRequestId;
  const numberPointScale = Prop.numberPointScale;
  const currentCommunityNoteCategory = Prop.currentCommunityNoteCategory;
  const communityNote = Prop.communityNote;
  const currentCommentOnNote = Prop.commentOnNote;
  const [tags, setTags] = useState<string[]>(currentTags);
  const [isDropdownOpen, setDropdownOpen] = useState(false); // Track dropdown state
  // Saved CommunityCategory
  const [communityCategory, setCommunityCategory] = useState<string | null>(
    currentCategory
  );

  // Saved VoteCategory
  const [voteCategory, setVoteCategory] = useState<string | null>(
    currentCategory
  );

  //take global values from user context
  const [truthScore, setTruthScore] = useState<number | null>(
    currentTruthScore
  );

  const [enabledAccordions, setEnabledAccordions] = useState<number[]>([1]);

  const [commentOnNote, setCommentOnNote] = useState(
    currentCommentOnNote ?? ""
  );

  const handleOpen = (value: number) => {
    if (enabledAccordions.includes(value)) {
      setOpen((prev) => [...prev, value]);
    }
  };

  const handleNextStep = (value: number) => {
    // Enable the next accordion and open it
    setEnabledAccordions((prev) => [...prev, value]);
    setOpen((prev) => [...prev, value]);
  };

  const onNextStep = (value: number) => {
    handleNextStep(value);
  };

  const onSelectTagOption = (tags: string[]) => {
    setTags(tags);
    handleNextStep(3);
  };

  const handleDropdownToggle = (isOpen: boolean) => {
    setDropdownOpen(isOpen); // Update dropdown state
  };

  const handleSelectCommunityCategory = (value: string | null) => {
    setCommunityCategory(value);
  };

  const handleVoteCategorySelection = (value: string) => {
    setVoteCategory(value);
  };

  const handleTruthScoreChange = (value: number | null) => {
    setTruthScore(value);
  };

  const handleCommentOnNote = (value: string) => {
    setCommentOnNote(value);
  };

  return (
    <div className="mt-2">
      <Accordion
        open={open.includes(1)}
        icon={<Icon id={1} open={open.find((element) => element === 1)} />}
        className={`mb-3 rounded-lg border px-2 ${
          open.includes(1)
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50"
            : "border-blue-gray-200"
        }`}
      >
        <AccordionHeader
          onClick={() => handleOpen(1)}
          className="border-b-0 relative"
        >
          <div className="pl-6">
            <Typography
              variant="h6"
              className="text-primary-color3 dark:text-white"
            >
              Select message category:
            </Typography>
            <span className="absolute top-1/2 left-[-8px] transform -translate-y-1/2 -translate-x-1/2 grid min-h-[32px] min-w-[32px] place-items-center rounded-full bg-amber-700 text-md font-medium leading-none text-white">
              1
            </span>
          </div>
        </AccordionHeader>
        <AccordionBody className="pt-0 text-base font-normal">
          <VoteCategories
            messageId={messageId ?? null}
            voteRequestId={voteRequestId ?? null}
            currentCategory={currentCategory}
            currentTruthScore={currentTruthScore}
            currentTags={currentTags}
            numberPointScale={numberPointScale}
            onNextStep={onNextStep}
            onVoteCategorySelection={handleVoteCategorySelection}
            onTruthScoreChange={handleTruthScoreChange}
          />
        </AccordionBody>
      </Accordion>

      <Accordion
        disabled={enabledAccordions.includes(2) ? false : true}
        open={open.includes(2)}
        icon={<Icon id={2} open={open.find((element) => element === 2)} />}
        className={`mb-3 rounded-lg border px-2 ${
          open.includes(2)
            ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50"
            : "border-blue-gray-200"
        }`}
      >
        <AccordionHeader
          onClick={() => handleOpen(2)}
          className="border-b-0 relative"
        >
          <div className="pl-6">
            <div className="flex items-center space-x-2">
              <Typography
                variant="h6"
                className="text-primary-color3 dark:text-white"
              >
                Select tags:
              </Typography>
              <p className="text-xs text-gray-600 font-normal italic">
                (optional)
              </p>
              <TooltipWithHelperIcon
                header="Tags"
                text="Select where appropriate. Multiple selections allowed."
              />
            </div>
            <span className="absolute top-1/2 left-[-8px] transform -translate-y-1/2 -translate-x-1/2 grid min-h-[32px] min-w-[32px] place-items-center rounded-full bg-amber-700 text-md font-medium leading-none text-white">
              2
            </span>
          </div>
        </AccordionHeader>
        <AccordionBody
          className={`pt-0 text-base font-normal ${
            isDropdownOpen ? "min-h-[150px]" : "min-h-[50px]"
          } transition-all duration-300`}
        >
          <VoteTags
            tags={tags}
            onSelectTag={onSelectTagOption}
            onDropdownToggle={handleDropdownToggle}
          />

          {voteCategory &&
          communityNote &&
          voteCategory != "pass" ? (
            tags && !open.includes(3) ? (
              <Button
                fullWidth
                className="flex items-center justify-center gap-3 bg-green-400"
                size="sm"
                onClick={() => handleNextStep(3)}
              >
                Move to next step
                <ForwardIcon className="h-5 w-5" />
              </Button>
            ) : null
          ) : (
            <DoneButton
              messageId={messageId ?? null}
              voteRequestId={voteRequestId ?? null}
              communityCategory={null}
              voteCategory={voteCategory}
              truthScore={truthScore}
              tags={tags}
              commentOnNote={commentOnNote}
            />
          )}
        </AccordionBody>
      </Accordion>
        <Accordion
          disabled={enabledAccordions.includes(3) ? false : true}
          open={open.includes(3)}
          icon={<Icon id={3} open={open.find((element) => element === 3)} />}
          className={`mb-3 rounded-lg border px-2 ${
            open.includes(3)
              ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50"
              : "border-blue-gray-200"
          }`}
        >
          <AccordionHeader
            onClick={() => handleOpen(3)}
            className="border-b-0 relative"
          >
            <div className="pl-6">
              <Typography
                variant="h6"
                className="text-primary-color3 dark:text-white"
              >
                Rate community note:
              </Typography>
              <span className="absolute top-1/2 left-[-8px] transform -translate-y-1/2 -translate-x-1/2 grid min-h-[32px] min-w-[32px] place-items-center rounded-full bg-amber-700 text-md font-medium leading-none text-white">
                3
              </span>
            </div>
          </AccordionHeader>
          <AccordionBody className="pt-0 text-base font-normal">
            <CommunityNoteCategories
              messageId={messageId ?? null}
              voteRequestId={voteRequestId ?? null}
              currentCommunityCategory={currentCommunityNoteCategory ?? null}
              commentOnNote={commentOnNote ?? ""}
              onNextStep={onNextStep}
              onSelectCommunityCategory={handleSelectCommunityCategory}
              onCommentOnNote={handleCommentOnNote}
            />

            {voteCategory && communityCategory ? (
              <DoneButton
                messageId={messageId ?? null}
                voteRequestId={voteRequestId ?? null}
                communityCategory={communityCategory}
                voteCategory={voteCategory}
                truthScore={truthScore}
                tags={tags}
                commentOnNote={commentOnNote}
              />
            ) : null}
          </AccordionBody>
        </Accordion>
    </div>
  );
}
