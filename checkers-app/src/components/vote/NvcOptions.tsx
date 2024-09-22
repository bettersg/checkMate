import {
  Radio,
  Typography,
  Card,
  ListItem,
  List,
} from "@material-tailwind/react";

interface nvcOptionsProps {
  selectedCategory: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

//0-5 truth score radio buttons selection
export default function nvcOptions(Prop: nvcOptionsProps) {
  const optionList = [
    {
      category: "legitimate",
      display: "Yes",
    },
    {
      category: "irrelevant",
      display: "Cannot Tell",
    },
  ];

  return (
    <div>
      <Typography className="text-primary-color text-justify my-3">
        Is the source a credible/reputable entity?
      </Typography>
      <Card className="w-full max-w-[24rem] my-3 dark:bg-dark-component-color">
        <List className="flex-row">
          {optionList.map((option) => (
            <ListItem className="p-0" key={option.category}>
              <Radio
                name="truth-score-options"
                id={`truth-score-${option.category}`}
                ripple={false}
                className="border-primary-color p-0 transition-all focus:outline-none focus:ring-0"
                containerProps={{
                  className: "p-2",
                }}
                label={
                  <Typography className="font-normal text-primary-color">
                    {option.display}
                  </Typography>
                }
                value={option.category}
                onChange={Prop.onChange}
                checked={Prop.selectedCategory === option.category}
                crossOrigin="anonymous"
                color="orange"
              />
            </ListItem>
          ))}
        </List>
      </Card>
    </div>
  );
}
