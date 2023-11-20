import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithCustomToken,
  connectAuthEmulator,
} from "firebase/auth";
import "./App.css";
import app from "./firebase";
import { UserProvider } from './UserContext';
import {
  AchievementPage,
  DashboardPage,
  VotingPage,
  MyVotesPage,
} from "./pages";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Message } from "./types";

const router = createBrowserRouter([
  { path: "/", element: <DashboardPage /> },
  { path: "myvotes", element: <MyVotesPage /> },
  { path: "achievements", element: <AchievementPage /> },
  {
    path: ":messageId/voting",
    element: <VotingPage />,
  },
  ]);

const auth = getAuth(app);
if (import.meta.env.MODE === "dev") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); //TODO: FOR DEV ONLY, need to change env variables later.
}

function App() {
  const [count, setCount] = useState(0);
  const [telegramApp, setTelegramApp] = useState(null);
  //for global states: userID, name and messages
  const [userId, setUserId] = useState(null);
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp
    ) {
      setTelegramApp(window.Telegram.WebApp);
      const initData = window.Telegram.WebApp.initData;
      if (true || initData) {
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

  const testAPI = async () => {
    try {
      const user = auth.currentUser;
      let token;
      if (user) {
        token = await user.getIdToken();
      }

      const response = await fetch("/api/helloworld", {
        method: "GET", // or POST, PUT, etc. depending on your needs
        headers: {
          Authorization: `Bearer ${token}`, // Set the ID token here
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      // Do something with the data
      alert(JSON.stringify(data));
    } catch (error) {
      console.error("Error fetching data from API:", error);
      alert("Error fetching data");
    }
  };

  return (
    <UserProvider value={{ userId, name, messages, updateMessages: setMessages }}>
      <RouterProvider router={router} />
    </UserProvider>
  );
}

export default App;
