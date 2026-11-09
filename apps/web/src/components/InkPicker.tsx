import { inks } from "@yir/shared";
import { useInk } from "../lib/InkContext";
import "./InkPicker.css";

interface Props {
  label?: string;
  className?: string;
  /** Called after the site's inks change, e.g. to save the choice on a real tape. */
  onChange?: (inkId: string) => void;
  disabled?: boolean;
}

/** Choose the two inks. The whole site, the tape page and the print pieces update live. */
export function InkPicker({ label = "Choose your inks", className = "", onChange, disabled = false }: Props) {
  const { ink, setInk } = useInk();
  return (
    <fieldset className={`inkpick ${className}`} disabled={disabled}>
      <legend className="label">{label}</legend>
      <div className="inkpick__opts">
        {inks.map((i) => (
          <label key={i.id} className="inkpick__opt">
            <input
              type="radio"
              name="ink"
              value={i.id}
              checked={ink.id === i.id}
              onChange={() => {
                setInk(i.id);
                onChange?.(i.id);
              }}
            />
            <span className="inkpick__dots" aria-hidden="true">
              <i style={{ background: i.light.ink }} />
              <i style={{ background: i.light.pop }} />
            </span>
            <span>{i.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
