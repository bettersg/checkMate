import { useState } from "react";
import { useLocation } from "react-router-dom";
import { router } from "../App";
import { useUpdateFactChecker } from "../services/mutations";
import { Checker } from "../types";

const NameForm = ({
  name,
  setName,
}: {
  name: string;
  setName: React.Dispatch<React.SetStateAction<string>>;
}) => {
  return (
    <div className="py-3">
      {/* TODO: Form validations using Zod  */}
      <label htmlFor="onboardingNameInput">
        Please fill in your name here:{" "}
      </label>
      <input
        id="onboardingNameInput"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border mt-2 p-3 rounded"
        placeholder="CheckMate"
      />
    </div>
  );
};

const ThankYou = ({ name }: { name: string }) => {
  return (
    <div>
      <p>Thank you and welcome, {name}!</p>
    </div>
  );
};

const StepOne = () => {
  return (
    <div>
      <p>
        Welcome to our community of CheckMates! 👋🏻 We're grateful to have you on
        board to combat misinformation and scams. 🙇‍♀️🙇🏻 We'd love to get to know
        you better - could you share your name with us?
      </p>
    </div>
  );
};

const StepTwo = () => {
  return (
    <div>
      <p>
        We're thrilled to have you on board as we work together to combat
        misinformation and scams.😊
      </p>
      <p>
        By using the CheckMate bot, you are accepting our privacy policy which
        can be found here:
      </p>
      <br />
      <a
        className="underline text-checkLink"
        href="https://bit.ly/checkmate-privacy"
      >
        https://bit.ly/checkmate-privacy
      </a>
    </div>
  );
};

const StepThree = () => {
  return (
    <>
      <p>
        To ensure you're equipped with the necessary skills to identify
        misinformation and scams, let's start with a quick quiz. 📝
      </p>
      <br />
      <p>Simply follow the link to take the quiz:</p>
      <p>
        <a
          className="underline text-checkLink"
          href="https://bit.ly/checkmates-quiz)"
        >
          https://bit.ly/checkmates-quiz)
        </a>
      </p>
      <br />
      <p>
        Once you've completed it, come back to this chat and click on "I've done
        the quiz!" to notify me.Let's get started! 🤖
      </p>
    </>
  );
};

const StepFour = () => {
  return (
    <p>
      Awesome! Now that you know how to identify misinformation and scams, you
      are ready to help us combat them! Thanks again for joining our community
      of CheckMates!
    </p>
  );
};

const steps: { [key: number]: JSX.Element } = {
  1: <StepOne />,
  2: <StepTwo />,
  3: <StepThree />,
  4: <StepFour />,
};

const numberOfSteps = Object.keys(steps).length;

const Onboarding = () => {
  const { state } = useLocation();

  const updateFactChecker = useUpdateFactChecker();

  const [name, setName] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const handleOnCompleteOnboarding = (factCheckerData: Checker) => {
    console.log(state?.factChecker.checkerId);
    updateFactChecker.mutate({
      checkerData: { ...factCheckerData, name, isOnboardingComplete: true },
      checkerId: state?.factChecker.checkerId,
    });
    router.navigate("/");
  };

  return (
    <div className="bg-checkBG min-h-screen flex flex-col items-center justify-center border border-black mt-4">
      {/* <p className="text-3xl">{JSON.stringify(factChecker)}</p> */}
      <h1 className="text-checkPrimary600 font-medium text-2xl">
        FactChecker's Onboarding
      </h1>
      <div className="p-5">
        <p className="font-bold">
          Step: {currentStep} out of {numberOfSteps}
        </p>
        {currentStep === 2 && <ThankYou name={name} />}
        <p className="pb-3">{steps[currentStep]}</p>
        {currentStep === 1 && <NameForm name={name} setName={setName} />}

        {currentStep !== numberOfSteps ? (
          <button
            className="p-2 font-medium rounded-xl bg-checkPrimary600 border"
            onClick={() => setCurrentStep(currentStep + 1)}
          >
            Next step
          </button>
        ) : (
          <button
            className="p-2 font-medium rounded-xl bg-checkPrimary600 border"
            onClick={() => handleOnCompleteOnboarding(state.factCheckerData)}
          >
            Complete Onboarding
          </button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
