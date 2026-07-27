import { useCallback, useEffect, useRef, useState } from "react";

export const SEARCH_MIN_CHARS = 4;
const DEBOUNCE_MS = 400;
const PER_PAGE = 200;

// Zoho's criteria parser treats ( ) , \ as syntax and offers no escape for them
// inside a value, so they are stripped rather than passed through — sending them
// raw returns INVALID_QUERY.
function sanitizeTerm(raw) {
  return (raw ?? "").replace(/[(),\\]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Debounced search over Submission_Logs by the Deal_Name field.
 *
 * Operator note (verified against the live CRM): this module's text fields
 * reject `contains`; `starts_with` is supported and behaves as a
 * case-insensitive WORD-prefix match — "test" matches both "test test" and
 * "Developer Testing", but a mid-word fragment such as "eeee" matches nothing.
 * Callers should therefore union these results with a client-side substring
 * filter over the rows already loaded.
 *
 * Returns records straight from the API; filtering/merging is the caller's job.
 */
export function useDealNameSearch({
  minChars = SEARCH_MIN_CHARS,
  delay = DEBOUNCE_MS,
} = {}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | pending | searching | success | error

  // Monotonic token: only the newest request is allowed to write state, so a
  // slow early response can never overwrite a fast later one.
  const latestRequest = useRef(0);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const query = sanitizeTerm(term);

    if (query.length < minChars) {
      latestRequest.current += 1; // invalidate anything in flight
      setResults([]);
      setStatus("idle");
      return undefined;
    }

    setStatus("pending");
    const timer = setTimeout(() => {
      const token = ++latestRequest.current;
      setStatus("searching");

      window.ZOHO.CRM.API.searchRecord({
        Entity: "Submission_Logs",
        Type: "criteria",
        Query: `(Deal_Name:starts_with:${query})`,
        per_page: PER_PAGE,
        page: 1,
      })
        .then((resp) => {
          if (!isMounted.current || token !== latestRequest.current) return;
          // A miss resolves with no `data` array rather than an empty one.
          setResults(Array.isArray(resp?.data) ? resp.data : []);
          setStatus("success");
        })
        .catch((err) => {
          if (!isMounted.current || token !== latestRequest.current) return;
          console.error("[DealNameSearch] search failed", err);
          setResults([]);
          setStatus("error");
        });
    }, delay);

    return () => clearTimeout(timer); // keystroke or unmount cancels the pending fire
  }, [term, minChars, delay]);

  const clear = useCallback(() => {
    latestRequest.current += 1;
    setTerm("");
    setResults([]);
    setStatus("idle");
  }, []);

  const trimmedLength = sanitizeTerm(term).length;

  return {
    term,
    setTerm,
    clear,
    results,
    status,
    isBusy: status === "pending" || status === "searching",
    isTooShort: trimmedLength > 0 && trimmedLength < minChars,
    failed: status === "error",
    minChars,
  };
}
