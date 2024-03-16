import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithCustomToken,
  connectAuthEmulator,
} from "firebase/auth";
import "./App.css";
import app from "./firebase";
import { UserProvider } from "./providers/UserContext";
import {
  AchievementPage,
  DashboardPage,
  ViewVotePage,
  MyVotesPage,
} from "./pages";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "/votes", element: <MyVotesPage /> },
  { path: "/achievements", element: <AchievementPage /> },
  {
    path: "/messages/:messageId/voteRequests/:voteRequestId",
    element: <ViewVotePage />,
  },
]);

const auth = getAuth(app);
if (import.meta.env.MODE === "dev") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); //TODO: FOR DEV ONLY, need to change env variables later.
}

function App() {
  const [count, setCount] = useState(0);
  const [telegramApp, setTelegramApp] = useState({});
  //for global states: userID, name and messages
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState("");

  // TODO: BRENNAN - Clean up
  console.log(count, setCount, telegramApp);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp
    ) {
      setTelegramApp(window.Telegram.WebApp);
      const initData = window.Telegram.WebApp.initData;
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
            if (data.customToken) {
              setUserId(data.userId);
              setName(data.name);
              signInWithCustomToken(auth, data.customToken).catch((error) => {
                console.error(
                  "Error during Firebase signInWithCustomToken",
                  error
                );
              });
            }
          })
          .catch((err) => {
            alert(err);
            console.error("Error fetching custom token:", err);
          });
      }
    }
  }, []);

  return (
    <UserProvider>
      <RouterProvider router={router} />
    </UserProvider>
  );
}

export default App;
