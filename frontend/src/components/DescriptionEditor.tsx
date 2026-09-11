import { useId, useRef } from "react";
import { Bold, Italic, List, Pilcrow } from "lucide-react";

export function DescriptionEditor({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  function format(kind: "bold" | "italic" | "list" | "paragraph") {
    const input = ref.current;
    if (!input) return;
    let start = input.selectionStart;
    let end = input.selectionEnd;
    let selected = value.slice(start, end);
    let replacement: string;
    let offset = 0;
    if (kind === "list") {
      start = value.lastIndexOf("\n", start - 1) + 1;
      const nextLine = value.indexOf("\n", end);
      end = nextLine === -1 ? value.length : nextLine;
      selected = value.slice(start, end);
      const lines = selected.split("\n");
      const remove = lines.every(line => /^- /.test(line));
      replacement = lines.map(line => remove ? line.slice(2) : "- " + line).join("\n");
    } else if (kind === "paragraph") {
      replacement = "\n\n";
      offset = 2;
    } else {
      const marker = kind === "bold" ? "**" : "*";
      const wrapped = selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2;
      replacement = wrapped ? selected.slice(marker.length, -marker.length) : marker + selected + marker;
      offset = wrapped ? 0 : marker.length;
    }
    onChange(value.slice(0, start) + replacement + value.slice(end));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + offset, start + (start === end || kind === "paragraph" ? offset : replacement.length - offset));
    });
  }
  return <div className="description-editor">
    <label htmlFor={id}>{label}</label>
    <div className="description-toolbar" role="group" aria-label={label}>
      {([
        ["bold", Bold, "Жирний"],
        ["italic", Italic, "Курсив"],
        ["list", List, "Маркований список"],
        ["paragraph", Pilcrow, "Новий абзац"]
      ] as const).map(([kind, Icon, title]) => <button key={kind} type="button" title={title} aria-label={title}
        onMouseDown={event => event.preventDefault()} onClick={() => format(kind)}><Icon size={18} /></button>)}
    </div>
    <textarea id={id} ref={ref} rows={9} value={value} onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && ["b", "i"].includes(event.key.toLowerCase())) {
          event.preventDefault();
          format(event.key.toLowerCase() === "b" ? "bold" : "italic");
        }
      }} />
  </div>;
}
