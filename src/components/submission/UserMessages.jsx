import { useState, useEffect, useRef, Fragment } from "react";
import "./UserMessages.css";

const ADMIN_NOTE_TITLE = "Admin Note";

function formatDay(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

export function UserMessages({ submissionLog }) {
  const [notes, setNotes] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!submissionLog?.id) return;
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionLog]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [notes]);

  async function fetchNotes() {
    const res = await window.ZOHO.CRM.API.getRelatedRecords({
      Entity: "Submission_Logs",
      RecordID: submissionLog.id,
      RelatedList: "Notes",
    });
    const sorted = (res?.data ?? []).sort(
      (a, b) => new Date(a.Created_Time) - new Date(b.Created_Time),
    );
    setNotes(sorted);
  }

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    await window.ZOHO.CRM.API.insertRecord({
      Entity: "Notes",
      APIData: {
        Note_Title: ADMIN_NOTE_TITLE,
        Note_Content: message.trim(),
        Parent_Id: submissionLog.id,
        se_module: "Submission_Logs",
      },
    });
    setMessage("");
    await fetchNotes();
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="um-root">
      <div className="um-list">
        {notes.length === 0 ? (
          <div className="um-empty">
            <div className="um-empty-ic">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="um-empty-title">No messages yet</p>
            <p className="um-empty-sub">Write a note below to start the conversation on this submission.</p>
          </div>
        ) : (
          notes.map((note, i) => {
            const isAdmin = note.Note_Title === ADMIN_NOTE_TITLE;
            const initials = (note.Owner?.name ?? "?")[0].toUpperCase();
            const day = formatDay(note.Created_Time);
            const showDay = i === 0 || day !== formatDay(notes[i - 1].Created_Time);
            return (
              <Fragment key={note.id}>
                {showDay && (
                  <div className="um-day"><span>{day}</span></div>
                )}
                <div className={`um-row ${isAdmin ? "um-row--right" : "um-row--left"}`}>
                  {!isAdmin && (
                    <div className="um-avatar um-avatar--user">{initials}</div>
                  )}
                  <div className="um-body">
                    <div className={`um-meta ${isAdmin ? "um-meta--right" : ""}`}>
                      {!isAdmin && (
                        <span className="um-author">{note.Owner?.name}</span>
                      )}
                      <span className="um-time">
                        {formatTime(note.Created_Time)}
                      </span>
                      {isAdmin && <span className="um-author">Admin</span>}
                    </div>
                    <div className={`um-bubble ${isAdmin ? "um-bubble--admin" : "um-bubble--user"}`}>
                      {note.Note_Content}
                    </div>
                  </div>
                  {isAdmin && <div className="um-avatar um-avatar--admin">A</div>}
                </div>
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="um-input-row">
        <input
          className="um-input"
          type="text"
          placeholder="Write a note to add to this submission..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="um-send-btn"
          onClick={handleSend}
          disabled={sending || !message.trim()}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/Madrid",
  });
}
