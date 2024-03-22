import {
  Radio,
  Typography,
  Card,
  ListItem,
  List,
} from "@material-tailwind/react";

interface TruthScoreOptionsProps {
  selectedTruthScore: number | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface InfoOptionsProps {
  selectedTruthScore: number | null;
  handleTruthScoreChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

//0-5 truth score radio buttons selection
function TruthScoreOptions(Prop: TruthScoreOptionsProps) {
  const numberList = Array.from({ length: 5 }, (_, index) => index + 1);

  return (
    <Card className="w-full max-w-[24rem] my-3 dark:bg-dark-component-color">
      <List className="flex-row">
        {numberList.map((number) => (
          <ListItem className="p-0" key={number}>
            <Radio
              name="truth-score-options"
              id={`truth-score-${number}`}
              ripple={false}
              className="border-primary-color p-0 transition-all focus:outline-none focus:ring-0"
              containerProps={{
                className: "p-2",
              }}
              label={
                <Typography className="font-normal text-primary-color">
                  {number}
                </Typography>
              }
              value={number}
              onChange={Prop.onChange}
              checked={Prop.selectedTruthScore === number}
              crossOrigin="anonymous"
              color="orange"
            />
          </ListItem>
        ))}
      </List>
    </Card>
  );
}

//display tier 2 voting (satire/truthscore) on "info" cat selection
export default function InfoOptions(Prop: InfoOptionsProps) {
  return (
    <div>
      {
        <>
          <Typography className="text-primary-color text-justify my-3">
            Please assess the veracity of the claim(s) in the message on a scale
            from 0 (entirely false) to 5 (entirely true).
          </Typography>
          <TruthScoreOptions
            selectedTruthScore={Prop.selectedTruthScore}
            onChange={Prop.handleTruthScoreChange}
          />
        </>
      }
    </div>
  );
}
