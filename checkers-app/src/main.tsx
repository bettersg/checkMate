import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { UserProvider } from "./providers/UserContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2 },
  },
});

const isDev = !!import.meta.env.DEV;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <App />
      </UserProvider>
      {isDev && <ReactQueryDevtools />}
    </QueryClientProvider>
  </React.StrictMode>
);
