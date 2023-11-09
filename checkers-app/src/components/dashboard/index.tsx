import PendingMessageAlert from "./PendingMsgAlert";
import React from "react";

export default function Dashboard() {
  return (
    <div>
      <PendingMessageAlert Type={true} />
      <PendingMessageAlert Type={false} />
    </div>
  );
}
