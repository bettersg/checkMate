import ErrorSplashPage from "../components/error";

export default function NotYetOnboardedPage() {
  return (
    <ErrorSplashPage
      header="You have not yet onboarded"
      details="Please onboard by typing /onboard in the Telegram chat and going through the steps. Once onboarding is completed, you can return here to explore the functions."
    />
  );
}
