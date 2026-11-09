import { useId, useState } from "react";
import { Button } from "./Button";

/**
 * A link to copy, with a button that falls back to selecting the text.
 * `link` is shown as is. `url` is what gets copied, defaulting to https:// plus the link.
 */
export function ShareLink({ link, url }: { link: string; url?: string }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url ?? `https://${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById(id);
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  };
  return (
    <div className="share">
      <code id={id}>{link}</code>
      <Button variant="light" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}
