import { useEffect, useId, useRef, useState } from "react";
import { ProductDescription } from "./ProductDescription";

export function CollapsibleProductDescription({ text, expandLabel, collapseLabel }: { text: string; expandLabel: string; collapseLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const [plain, setPlain] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    setPlain(content.current?.textContent?.replace(/\s+/g, " ").trim() ?? "");
    setExpanded(false);
  }, [text]);
  const characters = Array.from(plain);
  const long = characters.length > 40;
  return <div className="inventory-description" data-expanded={expanded}>
    <div className="inventory-description-full" id={id} ref={content}><ProductDescription text={text} /></div>
    {!expanded ? <p className="inventory-description-preview">{characters.slice(0, 40).join("")}{long ? "..." : ""}</p> : null}
    {long ? <button className="inventory-description-toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
      {expanded ? collapseLabel : expandLabel}
    </button> : null}
  </div>;
}
