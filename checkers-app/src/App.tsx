import { useEffect, useState } from "react";
import "./App.css";
import { signInWithToken } from "./utils/signin";
import {
  AchievementPage,
  DashboardPage,
  ViewVotePage,
  MyVotesPage,
} from "./pages";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useUser } from "./providers/UserContext";
import Onboarding from "./pages/Onboarding";
import Loading from "./components/common/Loading";

export const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "/votes", element: <MyVotesPage /> },
  { path: "/achievements", element: <AchievementPage /> },
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
  const { setCheckerId, setCheckerName } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  //for global states: userID, name and messages

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp
    ) {
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
              router.navigate("/onboarding", {
                state: {
                  authScope: data,
                },
              });
            } else {
              //if existing user
              signInWithToken(
                data.customToken,
                setCheckerId,
                setCheckerName,
                data.checkerId,
                data.name
              )
                .then(() => {
                  // Handle post-signIn success actions here, if any
                  console.log("Sign-in successful");
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
            console.log("sign-in complete");
            setIsLoading(false);
          });
      }
    }
  }, [setCheckerId, setCheckerName]);

  if (isLoading) {
    return <Loading />;
  }

  return <RouterProvider router={router} />;
}

export default App;
