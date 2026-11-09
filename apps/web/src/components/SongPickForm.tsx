import { LIMITS, sastDate } from "@yir/shared";
import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { LinerNote } from "./LinerNote";
import type { Track } from "../data/types";
import { ApiError } from "../lib/api";
import { newId } from "../lib/demoStore";
import { isUrl, resizePhoto } from "../lib/tape";

const PICK_FIELDS = ["contributor", "tagline", "song", "artist", "message"] as const;
const today = () => sastDate(new Date());
export const blankTrack = (): Track => ({ id: newId(), contributor: "", tagline: "", since: "", song: "", artist: "", link: "", message: "" });

interface Props {
  honoree: string;
  bornYear: number;
  organiserName: string;
  initial?: Track;
  submitLabel: string;
  /**
   * Save the pick. `photo` is a small JPEG data URL, `null` when the friend removed their photo,
   * or `undefined` when it didn't change. Throw an ApiError to show a message.
   */
  onSubmit: (track: Track, photo: string | null | undefined) => Promise<void>;
  /** Extra buttons next to the submit button, e.g. delete. */
  actions?: ReactNode;
  /** Shown instead of the photo when editing a saved song that has one. */
  hasSavedPhoto?: boolean;
}

/** The friend's form: about you, your song, the liner note and a photo, with a live preview of the card. */
export function SongPickForm({ honoree, bornYear, organiserName, initial, submitLabel, onSubmit, actions, hasSavedPhoto = false }: Props) {
  const [draft, setDraft] = useState<Track>(() => initial ?? blankTrack());
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Track>) => setDraft((d) => ({ ...d, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!draft.contributor.trim()) e.contributor = "Add your name so they know who picked it.";
    if (!draft.tagline.trim()) e.tagline = 'Add a few words, like "Res neighbour" or "Cousin".';
    if (!draft.since) e.since = "Roughly when did you meet? A guess is fine.";
    else if (draft.since > today()) e.since = "That date is in the future.";
    if (!draft.song.trim()) e.song = "Which song?";
    if (!draft.artist.trim()) e.artist = "Who's it by?";
    if (draft.link && !isUrl(draft.link)) e.link = "Paste the full link, starting with https://, or leave it empty.";
    if (draft.message.trim().length < 20) e.message = "Write a little more. Why this song?";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const focusFirstError = () => requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());

  const submit = async () => {
    setFormError("");
    if (!validate()) return focusFirstError();
    const track: Track = {
      ...draft,
      contributor: draft.contributor.trim(),
      tagline: draft.tagline.trim(),
      song: draft.song.trim(),
      artist: draft.artist.trim(),
      message: draft.message.trim(),
      link: draft.link?.trim() || undefined,
    };
    setSaving(true);
    try {
      await onSubmit(track, photo);
    } catch (err) {
      if (err instanceof ApiError && err.field && (PICK_FIELDS as readonly string[]).includes(err.field)) {
        setErrors({ [err.field]: err.message });
        focusFirstError();
      } else if (err instanceof ApiError && err.field === "since") {
        setErrors({ since: err.message });
      } else if (err instanceof ApiError && err.field === "photo") {
        setPhotoError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "That didn't send. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (file?: File) => {
    setPhotoError("");
    if (!file) return;
    try {
      setPhoto(await resizePhoto(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "That photo didn't load. Try another one.");
    }
  };

  const shownPhoto = photo ?? (photo === null ? undefined : initial?.photo);
  const showSaved = hasSavedPhoto && photo === undefined;

  return (
    <div className="split">
      <form
        className="panel"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset className="fieldset">
          <legend className="label">About you</legend>
          <Field id="c-name" label="Your name" value={draft.contributor} limit={LIMITS.contributor} onChange={(e) => set({ contributor: e.target.value })} error={errors.contributor} autoComplete="name" />
          <div className="grid-2">
            <Field id="c-tagline" label="How you know them" hint="Printed in handwriting." value={draft.tagline} limit={LIMITS.tagline} onChange={(e) => set({ tagline: e.target.value })} error={errors.tagline} placeholder="Res neighbour, room 214" />
            <Field id="c-since" type="date" label="When you met" hint="Your track goes in this order." value={draft.since} max={today()} onChange={(e) => set({ since: e.target.value })} error={errors.since} />
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="label">Your song</legend>
          <div className="grid-2">
            <Field id="c-song" label="Song" value={draft.song} limit={LIMITS.song} onChange={(e) => set({ song: e.target.value })} error={errors.song} autoComplete="off" />
            <Field id="c-artist" label="Artist" value={draft.artist} limit={LIMITS.artist} onChange={(e) => set({ artist: e.target.value })} error={errors.artist} autoComplete="off" />
          </div>
          <Field
            id="c-link"
            type="url"
            inputMode="url"
            label="Link to the song (optional)"
            hint="From any music app. We turn it into one link that opens in everyone's app. Leave it empty and we'll find the song."
            value={draft.link ?? ""}
            onChange={(e) => set({ link: e.target.value })}
            error={errors.link}
            placeholder="https://"
          />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="label">Liner note</legend>
          <Field id="c-message" multiline label={`Why this song, for ${honoree}?`} hint="Write it to them. It's printed on your card." value={draft.message} limit={LIMITS.message} onChange={(e) => set({ message: e.target.value })} error={errors.message} />
          <div className={`field ${photoError ? "has-error" : ""}`}>
            <label htmlFor="c-photo">A photo of the two of you (optional)</label>
            <p className="field__hint" id="c-photo-hint">
              Printed in one ink, so any old photo works. Without one, your card shows your initials.
            </p>
            <div className="photo-pick">
              {shownPhoto && <img src={shownPhoto} alt="Your chosen photo" />}
              {showSaved && !shownPhoto && <span className="muted small">Your saved photo is attached.</span>}
              <input id="c-photo" type="file" accept="image/jpeg,image/png,image/*" aria-describedby="c-photo-hint" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              {(shownPhoto || showSaved) && (
                <button type="button" className="linkish" onClick={() => setPhoto(null)}>
                  Remove photo
                </button>
              )}
            </div>
            {photoError && <p className="field__err">{photoError}</p>}
          </div>
        </fieldset>

        <p className="muted small">Only {organiserName || "the organiser"} sees your pick before it goes on the tape. You can change or delete it with the private link we give you.</p>
        {formError && (
          <p className="field__err" role="alert">
            {formError}
          </p>
        )}
        <div className="row row--end">
          {actions}
          <Button type="submit" disabled={saving}>
            {saving ? "Sending..." : submitLabel}
          </Button>
        </div>
      </form>

      <aside>
        <p className="label muted">Your card, as you type</p>
        <LinerNote track={{ ...draft, photo: shownPhoto, since: draft.since && draft.since <= today() ? draft.since : "" }} code="??" honoree={honoree} bornYear={bornYear} />
      </aside>
    </div>
  );
}
