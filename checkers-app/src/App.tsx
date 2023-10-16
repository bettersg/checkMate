import { useState, useEffect } from "react";
import {
  getAuth,
  signInWithCustomToken,
  connectAuthEmulator,
} from "firebase/auth";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import app from "./firebase";
import Dashboard from "./components/Dashboard";

const auth = getAuth(app);
if (import.meta.env.MODE === "dev") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099"); //TODO: FOR DEV ONLY, need to change env variables later.
}

function App() {
  const [count, setCount] = useState(0);
  const [telegramApp, setTelegramApp] = useState(null);
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
              alert(data.customToken);
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
    // <>
    //   <div>
    //     <a href="https://vitejs.dev" target="_blank">
    //       <img src={viteLogo} className="logo" alt="Vite logo" />
    //     </a>
    //     <a href="https://react.dev" target="_blank">
    //       <img src={reactLogo} className="logo react" alt="React logo" />
    //     </a>
    //   </div>
    //   <h1>Vite + React</h1>
    //   <div className="card">
    //     <button onClick={testAPI}>count is {count}</button>
    //     <p>
    //       Edit <code>src/App.tsx</code> and save to test HMR
    //     </p>
    //   </div>
    //   <p className="read-the-docs">
    //     Click on the Vite and React logos to learn more
    //   </p>
    // </>
    <div>
      <Dashboard />
    </div>
  );
}

export default App;
