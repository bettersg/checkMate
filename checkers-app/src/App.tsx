import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithCustomToken,
  connectAuthEmulator,
} from "firebase/auth";
import "./App.css";
import app from "./firebase";
import {
  AchievementPage,
  DashboardPage,
  ViewVotePage,
  MyVotesPage,
} from "./pages";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useUser } from "./providers/UserContext";
import Onboarding from "./pages/Onboarding";

const router = createBrowserRouter([
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

const auth = getAuth(app);
if (import.meta.env.MODE === "dev") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); //TODO: FOR DEV ONLY, need to change env variables later.
}

function App() {
  const { setCheckerId, setCheckerName } = useUser();
  const [count, setCount] = useState(0);
  const [telegramApp, setTelegramApp] = useState({});
  //for global states: userID, name and messages

  // TODO: BRENNAN - Clean up
  console.log(count, setCount, telegramApp);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp
    ) {
      setTelegramApp(window.Telegram.WebApp);
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
            if (data.isNewUser) {
              // TODO BRENNAN: Redirect to onboarding page
              router.navigate("/onboarding", {
                state: {
                  checkerId: data.checkerId,
                },
              });
            } else {
              //if existing user
              signInWithCustomToken(auth, data.customToken)
                .then(() => {
                  setCheckerId(data.checkerId);
                  setCheckerName(data.name);
                })
                .catch((error) => {
                  console.error(
                    "Error during Firebase signInWithCustomToken",
                    error
                  );
                });
            }
          })
          .catch((err) => {
            console.error("Error fetching custom token:", err);
          });
      }
    }
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
