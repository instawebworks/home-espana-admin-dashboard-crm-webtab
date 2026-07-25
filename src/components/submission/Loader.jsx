import "./Loader.css";

export function Loader({ text = "Fetching submission data" }) {
  return (
    <div className="loader-wrap">
      <div className="spinner">
        <div className="spinner-ring" />
        <div className="spinner-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="13" x2="16" y2="13" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="8" y1="17" x2="16" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      <p className="loader-text">{text}</p>
      <div className="loader-dots">
        <span /><span /><span />
      </div>
    </div>
  );
}
