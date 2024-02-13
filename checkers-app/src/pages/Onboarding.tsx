import { useUpdateFactChecker } from "../services/mutations"
import { FactChecker } from "../types/factChecker";

const Onboarding = ({ factChecker }: { factChecker: FactChecker }) => {

  const updateFactChecker = useUpdateFactChecker();
  const handleOnCompleteOnboarding = () => {
    updateFactChecker.mutate({ ...factChecker, isOnboardingComplete: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1>ONBOARDING PAGE</h1>
      <p className="max-w-[250px] break-all">
        {JSON.stringify(factChecker)}
      </p>
      <button className="p-10 border rounded" onClick={handleOnCompleteOnboarding}>Complete Onboarding</button>
    </div>
  )
}

export default Onboarding