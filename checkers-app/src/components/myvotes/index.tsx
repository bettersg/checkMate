import MessagesDisplay from "./MessagesDisplay";
// import MessagesDisplayTest from "./MessagesDisplayTest";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function MyVotes() {
  const [activeTab, setActiveTab] = useState<"pending" | "voted">("pending");
  const location = useLocation();

  useEffect(() => {
    console.log(location)
    if (location.state) {
      if (location.state.status) {
        setActiveTab(location.state.status)
      }
    }
  }, [location, activeTab])
  
  return (
    <div>
      <div>
        <MessagesDisplay status = {location.state ? location.state.status : "pending"} scrollPosition = {location.state ? location.state.scrollPosition : 0} />
        {/* <MessagesDisplayTest /> */}
      </div>
    </div>
  );
}
