import { useState, useEffect } from "react";
import { useUser } from "../providers/UserContext";
import { useLocation } from "react-router-dom";
import { router } from "../App";
import { useUpdateFactChecker } from "../services/mutations";
import { sendOTP, checkOTP } from "../services/api";
import { signInWithToken, signOut } from "../utils/authManagement";
import PhoneInput from "react-phone-number-input";
import { formatPhoneNumberIntl } from "react-phone-number-input";

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
        By hitting "Next step" and continuing, you are accepting our privacy
        policy which can be found here:
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
  const { authScopes } = useUser();
  const { setCheckerId, setCheckerName } = useUser();
  const [whatsappId, setWhatsappId] = useState("");
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [isOTPValidated, setIsOTPValidated] = useState(false);
  const [singpassOpenId, setSingpassOpenId] = useState(null);
  const [otp, setOtp] = useState("");
  const { mutate: updateFactChecker } = useUpdateFactChecker();
  const [customAuthToken, setCustomAuthToken] = useState(
    authScopes?.customToken ?? ""
  );
  const [checkerId, updateCheckerId] = useState(authScopes?.checkerId ?? "");
  const [name, setName] = useState(authScopes?.name ?? "");
  const [currentStep, setCurrentStep] = useState(1);

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
          if (!customToken || !updatedCheckerId) {
            throw new Error("Custom token or checkerId not found in response");
          }
          console.log("202");
          updateCheckerId(updatedCheckerId);
          setCustomAuthToken(customToken);
          signOut().then(() => {
            signInWithToken(
              customToken,
              setCheckerId,
              setCheckerName,
              updatedCheckerId,
              name
            ).then(() => {
              console.log("Sign-in successful");
            });
          });
        }
        setIsOTPValidated(true);
        console.log("OTP checked");
      })
      .catch((error) => {
        console.error("Error checking OTP", error);
      });
  };

  const handleOnCompleteOnboarding = () => {
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
                signInWithToken(
                  customAuthToken,
                  setCheckerId,
                  setCheckerName,
                  checkerId,
                  name
                ).then(() => {
                  console.log("Sign-in successful");
                  router.navigate("/");
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
          </div>
        )}

        {currentStep !== numberOfSteps
          ? isOTPValidated && (
              <button
                className="p-2 font-medium rounded-xl bg-checkPrimary600 border"
                onClick={() => setCurrentStep(currentStep + 1)}
              >
                Next step
              </button>
            )
          : isOTPValidated && (
              <button
                className="p-2 font-medium rounded-xl bg-checkPrimary600 border"
                onClick={() => handleOnCompleteOnboarding()}
              >
                Complete Onboarding
              </button>
            )}
      </div>
    </div>
  );
};

export default Onboarding;
