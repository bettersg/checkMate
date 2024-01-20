import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithCustomToken,
  connectAuthEmulator,
} from "firebase/auth";
import "./App.css";
import app from "./firebase";
import { UserProvider } from './providers/UserContext';
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
  { path: "/checkers/:phoneNo/messages", element: <MyVotesPage /> },
  { path: "/achievements", element: <AchievementPage /> },
  {
    path: "/checkers/:phoneNo/messages/:msgId/voteRequest",
    element: <VotingPage />,
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
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [phoneNo, setPhoneNo] = useState('');
  const [unassessed, setUnassessed] = useState(0);
  const [unchecked, setUnchecked] = useState(0);
  const [pending, setPending] = useState<Message[]>([]);
  const [assessed, setAssessed] = useState<Message[]>([]);

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
              setPhoneNo(data.phoneNo);
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

  useEffect(() => {
    // Only call the API when phoneNo is available to update messages
    if (phoneNo) {
      const fetchData = async () => {
        try {
          const response = await fetch(`/api/checkers/${phoneNo}/messages`, {
            method: "GET",
          });
          console.log("After fetch");
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();

          // Convert the ISO string to Date object for all messages
          data.messages.forEach((msg: Message) => {
            msg.firstTimestamp = new Date(msg.firstTimestamp);
            if (msg.voteRequests.acceptedTimestamp != null) {
              msg.voteRequests.acceptedTimestamp = new Date(msg.voteRequests.acceptedTimestamp);
            }
            if (msg.voteRequests.createdTimestamp != null) {
              msg.voteRequests.createdTimestamp = new Date(msg.voteRequests.createdTimestamp);
            }
            if (msg.voteRequests.votedTimestamp != null) {
              msg.voteRequests.votedTimestamp = new Date(msg.voteRequests.votedTimestamp);
            }
            if (msg.voteRequests.checkTimestamp != null) {
              msg.voteRequests.checkTimestamp = new Date(msg.voteRequests.checkTimestamp);
            }
          });

          setMessages(data.messages);

          const PENDING: Message[] = data.messages.filter((msg: Message) => msg.voteRequests.category == null);
          const ASSESSED: Message[] = data.messages.filter((msg: Message) => msg.voteRequests.category != null);

          // Sort by date
          PENDING.sort((a, b) => b.firstTimestamp.getTime() - a.firstTimestamp.getTime());
          ASSESSED.sort((a, b) => b.firstTimestamp.getTime() - a.firstTimestamp.getTime());

          setPending(PENDING);
          setAssessed(ASSESSED);

          //calculate & update context pending unread
          const pending_unread = PENDING.filter((msg: Message) => !msg.voteRequests.isView).length;
          setUnassessed(pending_unread);
          //calculate & update assessed unread
          const assessed_unread = ASSESSED.filter((msg: Message) => !msg.voteRequests.isView).length;
          setUnchecked(assessed_unread);

        } catch (error) {
          console.error("Error fetching votes:", error);
        }
      };
      fetchData();
    }
  }, [phoneNo]);


  return (
    <UserProvider value={{
      userId, name, phoneNo: phoneNo, messages, updateMessages: setMessages, unassessed, updateUnassessed: setUnassessed, unchecked, updateUnchecked: setUnchecked, pending: pending,
      assessed: assessed, updatePending: setPending, updateAssessed: setAssessed
    }}>
      <RouterProvider router={router} />
    </UserProvider>
  );
}

export default App;
