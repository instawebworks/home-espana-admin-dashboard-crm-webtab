import { useState } from "react";
import { UserMessages } from "./UserMessages";
import { UserUploads } from "./UserUploads";
import "./Tabs.css";

const TABS = ["User Uploads", "User Messages"];

export function Tabs({ deal, submissionLog, attachMap }) {
  const [active, setActive] = useState(0);

  return (
    <div className="tabs-root">
      <div className="tabs-bar">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`tab-btn${active === i ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tabs-content">
        {active === 0 && (
          <UserUploads deal={deal} submissionLog={submissionLog} attachMap={attachMap} />
        )}
        {active === 1 && (
          <UserMessages submissionLog={submissionLog} />
        )}
      </div>
    </div>
  );
}
