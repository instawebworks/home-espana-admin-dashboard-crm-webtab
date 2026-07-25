import { useState, useEffect } from "react";
import { Tabs } from "./Tabs";
import { Loader } from "./Loader";

// Expanded-row detail for one Submission Log. Plays the role of the deal-view
// widget's useZohoInit: on the deal page the deal is the entry point and the
// submission log is searched; here the row IS the submission log and the
// related deal is fetched from it. Mounted fresh on every expand
// (Collapse unmountOnExit), so the data is always current — no caches.
export function SubmissionDetail({ row }) {
  const [data, setData] = useState(null); // { submissionLog, deal, attachMap }
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ZOHO = window.ZOHO;
        const [logResp, attachResp, dealResp] = await Promise.all([
          ZOHO.CRM.API.getRecord({ Entity: "Submission_Logs", RecordID: row.id }),
          ZOHO.CRM.API.getRelatedRecords({
            Entity: "Submission_Logs",
            RecordID: row.id,
            RelatedList: "Attachments",
            page: 1,
            per_page: 200,
          }),
          row.Related_Module_Name && row.Related_Record_ID
            ? ZOHO.CRM.API.getRecord({
                Entity: row.Related_Module_Name,
                RecordID: row.Related_Record_ID,
              })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const attachMap = {};
        (attachResp?.data ?? []).forEach((a) => { attachMap[a.id] = a; });

        setData({
          submissionLog: logResp?.data?.[0] ?? null,
          deal: dealResp?.data?.[0] ?? null,
          attachMap,
        });
      } catch (err) {
        console.error("[SubmissionDetail] Failed to load submission data", err);
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [row.id, row.Related_Module_Name, row.Related_Record_ID]);

  if (error || (data && !data.submissionLog)) {
    return (
      <p style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#5b6b82", background: "#f6f8fb", margin: 0 }}>
        Could not load this submission. Please try again.
      </p>
    );
  }

  if (!data) {
    return <Loader text="Fetching submission data" />;
  }

  return (
    <Tabs
      deal={data.deal}
      submissionLog={data.submissionLog}
      attachMap={data.attachMap}
    />
  );
}
