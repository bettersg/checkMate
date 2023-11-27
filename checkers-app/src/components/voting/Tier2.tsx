import { Radio, Typography, Card, ListItem, List } from "@material-tailwind/react";

interface TruthScoreOptionsProps {
  selectedTruthScore: number | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface InfoOptionsProps {
  truthScoreOptions: boolean;
  selectedTruthScore: number | null;
  handleSatireChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleTruthScoreChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

//0-5 truth score radio buttons selection
function TruthScoreOptions(Prop: TruthScoreOptionsProps) {
  const numberList = Array.from({ length: 6 }, (_, index) => index);

  return (
    <Card className="w-full max-w-[24rem] my-3">
      <List className="flex-row">
        {numberList.map((number) => (
          <ListItem className="p-0" key={number}>
            <Radio
              name="truth-score-options"
              id={`truth-score-${number}`}
              className="border-gray-900/10 bg-primary-color/50 p-0 transition-all"
              containerProps={{
                className: "p-2",
              }}
              label={
                <Typography
                  className="font-normal"
                >
                  {number}
                </Typography>
              }
              value={number}
              onChange={Prop.onChange}
              checked={Prop.selectedTruthScore === number}
              crossOrigin="anonymous"
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
      <Typography className="text-primary-color3">
        Is it a satire?
      </Typography>
      <div className="flex flex-row justify-around">
        <Radio
          className="border-gray-900/10 bg-primary-color/50 p-2 transition-all"
          label={
            <Typography
              className="font-normal"
            >
              Yes
            </Typography>
          }
          value="yes"
          onChange={Prop.handleSatireChange}
          crossOrigin="anonymous"
        />
        <Radio
          className="border-gray-900/10 bg-primary-color/50 p-2 transition-all"
          label={
            <Typography
              className="font-normal"
            >
              No
            </Typography>
          }
          value="no"
          onChange={Prop.handleSatireChange}
          crossOrigin="anonymous"
        />
      </div>
      {Prop.truthScoreOptions &&
        <>
          <Typography className="text-primary-color3 text-justify my-3">
            Please assess the veracity of the claim(s) in the message on a scale
            from 0 (entirely false) to 5 (entirely true).
          </Typography>
          <TruthScoreOptions selectedTruthScore={Prop.selectedTruthScore} onChange={Prop.handleTruthScoreChange} />
        </>}
    </div>
  )
}