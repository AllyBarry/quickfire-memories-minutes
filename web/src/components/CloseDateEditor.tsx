import { useState } from "react";
import { Button } from "./Button";
import "./Field.css";
import { planById } from "../data/plans";
import { useDemoStore } from "../lib/demoStore";
import { closeDate, defaultClose, fmtDateTime, isClosed, latestClose, toLocalInput } from "../lib/timeline";

/** Lets the organiser move the song-pick deadline, close it now, or reopen it. */
export function CloseDateEditor() {
  const { order, dispatch } = useDemoStore();
  const printed = planById(order.planId).printed;
  const close = closeDate(order.partyDate, printed, order.closeAt);
  const latest = latestClose(order.partyDate, printed);
  const suggested = defaultClose(order.partyDate, printed);
  const closed = isClosed(order.partyDate, printed, order.closeAt);

  const [editing, setEditing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [value, setValue] = useState(() => toLocalInput(closed ? latest : close));
  const [error, setError] = useState("");

  const open = () => {
    setValue(toLocalInput(closed ? new Date(Math.min(latest.getTime(), Math.max(Date.now() + 864e5, suggested.getTime()))) : close));
    setError("");
    setEditing(true);
  };

  const save = () => {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) return setError("Pick a date and time.");
    if (d.getTime() <= Date.now()) return setError("Pick a time in the future, or use Close now.");
    if (d.getTime() > latest.getTime()) {
      return setError(
        printed
          ? `That's too late to approve the running order before the print run. The latest is ${fmtDateTime(latest)}.`
          : `That leaves no time to approve the running order before the party. The latest is ${fmtDateTime(latest)}.`,
      );
    }
    // the suggested date is stored as "unset", so it keeps following the party date
    const isSuggested = Math.abs(d.getTime() - suggested.getTime()) < 60_000;
    dispatch({ type: "order", patch: { closeAt: isSuggested ? undefined : value, status: "collecting" } });
    setEditing(false);
  };

  const closeNow = () => {
    dispatch({ type: "order", patch: { closeAt: toLocalInput(new Date()), status: "curating" } });
    setConfirmingClose(false);
  };

  return (
    <div className="panel closecard">
      <div className="row row--between">
        <h3>Song picks close</h3>
        <span className={`chip ${closed ? "chip--hidden" : "chip--approved"}`}>{closed ? "Closed" : "Open"}</span>
      </div>
      <p className="closecard__when">
        <time dateTime={close.toISOString()}>{fmtDateTime(close)}</time>
      </p>
      <p className="muted small">
        {closed ? "Friends opening the link now see that the tape is closed." : order.closeAt ? "You set this time. Friends can add a song until then." : "Our suggested time, so you have a few days to set the running order."}
      </p>

      {editing ? (
        <div className="closecard__edit">
          <div className={`field ${error ? "has-error" : ""}`}>
            <label htmlFor="close-at">New close date and time</label>
            <p className="field__hint" id="close-at-hint">
              Latest: {fmtDateTime(latest)}, {printed ? "so there's a day to approve before the print run" : "so there's time to approve before the party"}.
            </p>
            <input
              id="close-at"
              type="datetime-local"
              value={value}
              min={toLocalInput(new Date())}
              max={toLocalInput(latest)}
              aria-describedby={error ? "close-at-hint close-at-err" : "close-at-hint"}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
            />
            {error && (
              <p className="field__err" id="close-at-err" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="row">
            <Button onClick={save}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {order.closeAt && !closed && (
              <button type="button" className="linkish" onClick={() => setValue(toLocalInput(suggested))}>
                Use suggested ({fmtDateTime(suggested)})
              </button>
            )}
          </div>
        </div>
      ) : confirmingClose ? (
        <div className="closecard__confirm" role="group" aria-label="Confirm closing song picks">
          <p>
            <strong>Close song picks now?</strong> Anyone who hasn't sent their song yet won't be able to. You can reopen later.
          </p>
          <div className="row">
            <Button onClick={closeNow}>Yes, close now</Button>
            <Button variant="ghost" onClick={() => setConfirmingClose(false)}>
              Keep open
            </Button>
          </div>
        </div>
      ) : (
        <div className="row">
          <Button variant="ghost" onClick={open}>
            {closed ? "Reopen song picks" : "Change date or time"}
          </Button>
          {!closed && (
            <Button variant="ghost" onClick={() => setConfirmingClose(true)}>
              Close now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
