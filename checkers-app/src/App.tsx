import { useState, useEffect } from "react";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import app from "./firebase";

const auth = getAuth(app);

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
      if (initData) {
        // Call your Firebase function to validate the receivedData and get custom token
        fetch("/telegramAuth", {
          method: "POST",
          body: initData,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.customToken) {
              signInWithCustomToken(auth, data.customToken).catch((error) => {
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

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
