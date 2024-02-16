import { useState } from "react";
import { useUpdateFactChecker } from "../services/mutations"
import { FactChecker } from "../types/factChecker";

const text = "Welcome to our community of CheckMates! 👋🏻 We're grateful to have you on board to combat misinformation and scams. 🙇‍♀️🙇🏻 We'd love to get to know you better - could you *reply to this message* and share your name with us? (Reply to this message by swiping right)!"
console.log(text)

const NameForm = ({ name, setName }: { name: string, setName: React.Dispatch<React.SetStateAction<string>> }) => {
  return (
    <div className="py-3">
      {/* TODO: Form validations using Zod  */}
      <label htmlFor="onboardingNameInput">Please fill in your name here: </label>
      <input id="onboardingNameInput" type="text" value={name} onChange={(e) => setName(e.target.value)} className="border p-3 rounded" placeholder="CheckMate" />
    </div>
  )
}


interface StepInstructions {
  'step': number;
  'text': string;
}

const stepInstructions: StepInstructions[] = [
  {
    'step': 1,
    'text': `Welcome to our community of CheckMates! 👋🏻 We're grateful to have you on board to combat misinformation and scams. 🙇‍♀️🙇🏻 We'd love to get to know you better - could you *reply to this message* and share your name with us? (Reply to this message by swiping right)!`,
    // 'action': <NameForm  />
  },
  {
    'step': 2,
    'text': `Thank you and welcome, Brennan! We're thrilled to have you on board as we work together to combat misinformation and scams.😊 By using the CheckMate bot, you are accepting our privacy policy which can be found here: https://bit.ly/checkmate-privacy`
  },
  {
    'step': 3,
    'text': `To ensure you're equipped with the necessary skills to identify misinformation and scams, let's start with a quick quiz. 📝 Simply follow the link (https://bit.ly/checkmates-quiz) to take the quiz. Once you've completed it, come back to this chat and click on "I've done the quiz!" to notify me. Let's get started! 🤖`
  },
  {
    'step': 4,
    'text': `Awesome! Now that you know how to identify misinformation and scams, you are ready to help us combat them! Use the '/info' command for more resources. Thanks again for joining our community of CheckMates!`
  }
]

const Onboarding = ({ factChecker }: { factChecker: FactChecker }) => {
  const [name, setName] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const updateFactChecker = useUpdateFactChecker();
  const handleOnCompleteOnboarding = () => {
    updateFactChecker.mutate({ ...factChecker, isOnboardingComplete: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <p className="max-w-[250px] break-all">
        {/* {JSON.stringify(factChecker)} */}
        User set name: {name}
      </p>
      <h1 className="text-checkPrimary600 font-medium text-[20px]">ONBOARDING PAGE</h1>
      <div className="p-5">
        {stepInstructions.map((step) => {
          return (
            step.step === currentStep && (
              <div>
                <p className="font-bold">Step: {step.step} out of {stepInstructions.length}</p>
                {step.step === 1 && <NameForm name={name} setName={setName} />}
                <p className="pb-3">{step.text}</p>
              </div>)
          )
        })}
        {currentStep !== stepInstructions.length ?
          <button className="p-2 font-medium rounded-[50px] bg-checkPrimary600 border" onClick={() => setCurrentStep(currentStep + 1)}>Next step</button> :
          <button className="p-2 font-medium rounded-[50px] bg-checkPrimary600 border" onClick={handleOnCompleteOnboarding}>Complete Onboarding</button>
        }
      </div>
    </div >
  )
}

export default Onboarding