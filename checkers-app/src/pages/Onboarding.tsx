import { useState } from "react";
import { useUser } from "../providers/UserContext";
import { router } from "../App";
import { useUpdateFactChecker } from "../services/mutations";
import { sendOTP, checkOTP } from "../services/api";
import { signInWithToken, signOut } from "../utils/authManagement";
import { Alert, Button } from "@material-tailwind/react";
import PhoneInput from "react-phone-number-input";

function openLink(url: string) {
  if (window.Telegram.WebApp) {
    window.Telegram.WebApp.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

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
        placeholder="Your Name"
        style={{ color: "black" }}
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
        By hitting "Next step" and continuing, you are accepting our privacy
        policy which can be found here:
      </p>
      <br />
      <a
        className="underline text-checkLink"
        onClick={() => openLink("https://bit.ly/checkmate-privacy")}
        href="#"
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
          onClick={() => openLink("https://bit.ly/checkmates-quiz")}
          href="#"
        >
          https://bit.ly/checkmates-quiz
        </a>
      </p>
      <br />
      <p>
        Once you've completed it, come back here and hit "Next step" to
        continue. We trust you've done it! 🌟
      </p>
    </>
  );
};

const StepFour = () => {
  return (
    <>
      <p>
        A few last things! Firstly, you should join our WhatsApp group at the
        following link, where all our checkers share relevant links from
        reputable news sources to aid fact checking. (But are not allowed to
        discuss what categories/scores to assign)
      </p>
      <br />
      <p>
        <a
          className="underline text-checkLink"
          onClick={() => openLink("https://bit.ly/checkmates-groupchat")}
          href="#"
        >
          https://bit.ly/checkmates-groupchat
        </a>
      </p>
      <br />
      <p>
        Next, for more details on the checking thought process and the
        definitions of our categories, you can always head over to:.
      </p>
      <br />
      <p>
        <a
          className="underline text-checkLink"
          onClick={() => openLink("https://bit.ly/checkmates-wiki")}
          href="#"
        >
          https://bit.ly/checkmates-wiki
        </a>
      </p>
      <br />
      <p>
        Awesome! Now that you know how to identify misinformation and scams, you
        are ready to help us combat them! Thanks again for joining our community
        of CheckMates!
      </p>
    </>
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
  const { setCheckerDetails, authScopes } = useUser();
  const [whatsappId, setWhatsappId] = useState("");
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [isOTPValidated, setIsOTPValidated] = useState(false);
  const [singpassOpenId, _] = useState(null);
  const [otp, setOtp] = useState("");
  const { mutate: updateFactChecker } = useUpdateFactChecker();
  const [customAuthToken, setCustomAuthToken] = useState(
    authScopes?.customToken ?? ""
  );
  const [checkerId, updateCheckerId] = useState(authScopes?.checkerId ?? "");
  const [name, setName] = useState(authScopes?.name ?? "");
  const [currentStep, setCurrentStep] = useState(1);
  const [showAlerts, setShowAlerts] = useState(false);

  const sendWhatsappOTP = () => {
    // Here you would add the logic to actually verify the phone number, probably by sending an API request
    // For now, we'll just set the phone as verified
    if (!checkerId) {
      throw new Error("Checker ID not found");
    }
    if (!whatsappId) {
      throw new Error("Whatsapp ID not found");
    }
    setIsOTPSent(true);
    sendOTP(checkerId, whatsappId.replace("+", "")).catch((error) => {
      console.error("Error sending OTP", error);
    });
  };

  const checkWhatsappOTP = () => {
    checkOTP(checkerId, otp)
      .then((data) => {
        if (data?.existing === true) {
          //only for existing checkers
          const customToken = data?.customToken;
          const updatedCheckerId = data?.checkerId;
          const isAdmin = data?.isAdmin;
          const tier = data?.tier;
          if (!customToken || !updatedCheckerId) {
            throw new Error("Custom token or checkerId not found in response");
          }
          updateCheckerId(updatedCheckerId);
          setCustomAuthToken(customToken);
          signOut().then(() => {
            signInWithToken(customToken).then(() => {
              setCheckerDetails((currentChecker) => ({
                ...currentChecker,
                checkerId: updatedCheckerId,
                checkerName: name,
                isAdmin: isAdmin ?? false,
                tier: tier ?? "beginner",
              }));
              handleOnCompleteOnboarding(updatedCheckerId); //immediately complete onboarding
            });
          });
        }
        setIsOTPValidated(true);
        setCurrentStep(currentStep + 1);
        setShowAlerts(false);
      })
      .catch((error) => {
        console.error("Error checking OTP", error);
        setShowAlerts(true);
      });
  };

  const handleOnCompleteOnboarding = (checkerId: string) => {
    if (!checkerId) {
      throw new Error("Checker ID not found");
    }
    if (!whatsappId) {
      throw new Error("Whatsapp ID not found");
    }
    if (!name) {
      throw new Error("Checker name not found");
    }
    // if (!singpassId) {
    //   throw new Error("Singpass ID not found");
    // }
    updateFactChecker(
      {
        checkerUpdateData: {
          singpassOpenId: singpassOpenId,
          name: name,
          isOnboardingComplete: true,
          isActive: true,
          preferredPlatform: "telegram",
        },
        checkerId: checkerId,
      },
      {
        onSuccess: () => {
          try {
            if (customAuthToken) {
              signOut().then(() => {
                signInWithToken(customAuthToken).then(() => {
                  setCheckerDetails((currentChecker) => ({
                    ...currentChecker,
                    checkerId: checkerId,
                    checkerName: name,
                  }));
                  router.navigate("/");
                  router.navigate(0);
                });
              });
            }
          } catch (error) {
            console.error("Error during Firebase signInWithCustomToken", error);
            throw new Error("Error during Firebase signInWithCustomToken");
          }
        },
      }
    );
  };

  return (
    <div className="bg-checkBG min-h-screen flex flex-col items-center border border-black mt-4 dark:bg-dark-background-color">
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
        {currentStep === 1 && (
          <div className="phone-input-container">
            <PhoneInput
              international
              countryCallingCodeEditable={false}
              placeholder="Your WhatsApp Number"
              defaultCountry="SG"
              value={whatsappId}
              onChange={(value: string) => {
                setWhatsappId(value);
              }}
              className="phone-input"
            />
            <button
              className="verify-button"
              onClick={sendWhatsappOTP}
              disabled={!whatsappId}
            >
              {isOTPSent ? "Resend" : "Verify"}
            </button>
          </div>
        )}
        {currentStep === 1 && isOTPSent && (
          <div className="otp-input-container active">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="otp-input"
              placeholder="Enter OTP"
            />
            <button
              className="submit-button"
              disabled={otp.length != 6}
              onClick={checkWhatsappOTP}
            >
              Submit
            </button>
            {showAlerts && (
              <Alert color="amber">
                An error occurred. You might have entered the wrong OTP
              </Alert>
            )}
          </div>
        )}

        {currentStep !== numberOfSteps
          ? isOTPValidated && (
              <Button
                className="bg-checkPrimary600 text-white"
                ripple={true}
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Next Step
              </Button>
            )
          : isOTPValidated && (
              <Button
                className="bg-checkPrimary600 text-white"
                ripple={true}
                onClick={() => handleOnCompleteOnboarding(checkerId)}
              >
                Complete Onboarding
              </Button>
            )}
      </div>
    </div>
  );
};

export default Onboarding;
