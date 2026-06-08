"use client";

import type { ReactNode } from "react";

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

function renderInline(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={`strong-${key++}`} className="font-semibold text-inherit">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={`em-${key++}`} className="italic text-inherit">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("==") && token.endsWith("==")) {
      tokens.push(
        <mark
          key={`mark-${key++}`}
          className="rounded bg-amber-100 px-1 py-0.5 text-slate-900"
        >
          {token.slice(2, -2)}
        </mark>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={`code-${key++}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

function isFieldValueLine(text: string) {
  const normalized = text.trim();
  return /^(\*\*)?[A-Za-zÀ-ÿ0-9 .()/#-]{2,40}(\*\*)?:\s+.+$/.test(normalized);
}

function renderBlocks(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClass =
        level <= 2
          ? "text-base font-semibold text-slate-900"
          : "text-sm font-semibold text-slate-800";
      blocks.push(
        <div key={`heading-${index}`} className={headingClass}>
          {renderInline(text)}
        </div>
      );
      index += 1;
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index].trimEnd();
        const candidateMatch = candidate.match(/^[-*]\s+(.*)$/);
        if (!candidateMatch) break;
        items.push(candidateMatch[1]);
        index += 1;
      }

      const allFieldValueItems = items.length > 0 && items.every((item) => isFieldValueLine(item));
      if (allFieldValueItems) {
        blocks.push(
          <div key={`fields-${index}`} className="space-y-2">
            {items.map((item, itemIndex) => (
              <p key={`field-item-${itemIndex}`} className="leading-6">
                {renderInline(item)}
              </p>
            ))}
          </div>
        );
      } else {
        blocks.push(
          <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
            {items.map((item, itemIndex) => (
              <li key={`ul-item-${itemIndex}`}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index].trimEnd();
        const candidateMatch = candidate.match(/^\d+\.\s+(.*)$/);
        if (!candidateMatch) break;
        items.push(candidateMatch[1]);
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const candidate = lines[index].trimEnd();
      if (!candidate.trim()) {
        index += 1;
        break;
      }
      if (
        /^(#{1,6})\s+/.test(candidate) ||
        /^[-*]\s+/.test(candidate) ||
        /^\d+\.\s+/.test(candidate)
      ) {
        break;
      }
      paragraphLines.push(candidate);
      index += 1;
    }

    blocks.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap leading-6">
        {renderInline(paragraphLines.join("\n"))}
      </p>
    );
  }

  return blocks;
}

export default function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return <div className={className}>{renderBlocks(content)}</div>;
}
