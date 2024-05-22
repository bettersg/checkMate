import { useEffect, useState } from "react";
import "./App.css";
import { signInWithToken, signOut } from "./utils/authManagement";
import {
  AchievementPage,
  DashboardPage,
  ViewVotePage,
  MyVotesPage,
  LeaderboardPage,
} from "./pages";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useUser } from "./providers/UserContext";
import Onboarding from "./pages/Onboarding";
import Loading from "./components/common/Loading";

export const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "/votes", element: <MyVotesPage /> },
  { path: "/achievements", element: <AchievementPage /> },
  { path: "/leaderboard", element: <LeaderboardPage /> },
  {
    path: "/messages/:messageId/voteRequests/:voteRequestId",
    element: <ViewVotePage />,
  },
  {
    path: "/onboarding",
    element: <Onboarding />,
  },
]);

function App() {
  const { setCheckerDetails, setAuthScopes } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  //for global states: userID, name and messages

  useEffect(() => {
    if (import.meta.env.MODE === "dev") {
      signOut().then(() => {
        console.log("Signed out");
      });
    }
    if (
      typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp
    ) {
      if (window.Telegram.WebApp.colorScheme === "dark") {
        document.documentElement.classList.add("dark");
      }
      let initData = window.Telegram.WebApp.initData;
      if (!initData && import.meta.env.MODE === "dev") {
        initData = "devdummy";
      }
      if (initData) {
        // Call your Firebase function to validate the receivedData and get custom token
        fetch("/telegramAuth/", {
          method: "POST",
          body: initData,
        })
          .then((response) => {
            if (!response.ok) {
              // Check if the status code is 403
              if (response.status === 403) {
                throw new Error(
                  "Forbidden: You don't have permission to access this site."
                );
              } else {
                throw new Error("HTTP Error: " + response.status);
              }
            }
            return response.json();
          })
          .then((data) => {
            if (!data.customToken) {
              throw new Error("Custom token not found in response");
            }
            if (data.isNewUser || data.isOnboardingComplete === false) {
              // TODO BRENNAN: Redirect to onboarding page
              signInWithToken(data.customToken)
                .then(() => {
                  // Handle post-signIn success actions here, if any
                  setCheckerDetails((currentChecker) => ({
                    ...currentChecker,
                    checkerId: data.checkerId,
                    checkerName: data.name,
                    isAdmin: data.isAdmin,
                    tier: data.tier,
                  }));
                  setAuthScopes(data);
                  router.navigate("/onboarding");
                })
                .catch((err) => {
                  console.error(
                    "Error during Firebase signInWithCustomToken:",
                    err
                  );
                  // Handle sign-in error here, if necessary
                });
              setAuthScopes(data);
            } else {
              //if existing user
              signInWithToken(data.customToken)
                .then(() => {
                  setCheckerDetails((currentChecker) => ({
                    ...currentChecker,
                    checkerId: data.checkerId,
                    checkerName: data.name,
                    isAdmin: data.isAdmin,
                    tier: data.tier,
                  }));
                })
                .catch((err) => {
                  console.error(
                    "Error during Firebase signInWithCustomToken:",
                    err
                  );
                  // Handle sign-in error here, if necessary
                });
            }
          })
          .catch((err) => {
            console.error("Error fetching custom token:", err);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    }
  }, [setCheckerDetails]);

  if (isLoading) {
    return <Loading />;
  }

  return <RouterProvider router={router} />;
}

export default App;
