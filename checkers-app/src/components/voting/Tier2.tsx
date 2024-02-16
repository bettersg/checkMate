import { Radio, Typography, Card, ListItem, List } from "@material-tailwind/react";

interface TruthScoreOptionsProps {
  selectedTruthScore: number | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface InfoOptionsProps {
  selectedTruthScore: number | null;
  isSatire: boolean | null;
  handleSatireChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTruthScoreChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

//0-5 truth score radio buttons selection
function TruthScoreOptions(Prop: TruthScoreOptionsProps) {
  const numberList = Array.from({ length: 6 }, (_, index) => index);

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
                <Typography
                  className="font-normal text-primary-color"
                >
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
    </Card >
  );
}

//display tier 2 voting (satire/truthscore) on "info" cat selection
export default function InfoOptions(Prop: InfoOptionsProps) {

  return (
    <div>
      <Typography className="text-primary-color">
        Is it a satire?
      </Typography>
      <div className="flex flex-row justify-around">
        <Radio
          className="p-2 transition-all border border-primary-color"
          label={
            <Typography
              className="font-normal text-primary-color"
            >
              Yes
            </Typography>
          }
          value="yes"
          ripple={false}
          onChange={Prop.handleSatireChange}
          checked={Prop.isSatire === true}
          crossOrigin="anonymous"
          color="orange"
        />
        <Radio
          className="border border-primary-color p-2  focus:outline-none focus:ring-0"
          label={
            <Typography
              className="font-normal text-primary-color"
            >
              No
            </Typography>
          }
          value="no"
          ripple={false}
          onChange={Prop.handleSatireChange}
          checked={Prop.isSatire === false}
          crossOrigin="anonymous"
          color="orange"
        />
      </div>
      {Prop.isSatire === false &&
        <>
          <Typography className="text-primary-color text-justify my-3">
            Please assess the veracity of the claim(s) in the message on a scale
            from 0 (entirely false) to 5 (entirely true).
          </Typography>
          <TruthScoreOptions selectedTruthScore={Prop.selectedTruthScore} onChange={Prop.handleTruthScoreChange} />
        </>}
    </div>
  )
}