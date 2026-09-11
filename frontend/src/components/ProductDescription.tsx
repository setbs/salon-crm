import Markdown from "react-markdown";

export function ProductDescription({ text }: { text: string }) {
  return <div className="formatted-description"><Markdown
    allowedElements={["p", "strong", "em", "ul", "ol", "li", "br"]}
    unwrapDisallowed
    skipHtml
  >{text}</Markdown></div>;
}
