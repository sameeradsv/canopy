"use client";

import { useEffect, useId, useState } from "react";
import { api, type Tag } from "@/lib/api";

export function TagInput({
  value,
  onChange,
  placeholder = "follow-up, work (comma-separated)",
  className = "input",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    api.listTags().then(setTags).catch(() => setTags([]));
  }, []);

  const lastSegment = value.includes(",") ? value.slice(value.lastIndexOf(",") + 1).trim() : value.trim();
  const prefix = value.includes(",") ? value.slice(0, value.lastIndexOf(",") + 1) : "";

  const suggestions = tags
    .map((t) => t.name)
    .filter((name) => {
      if (!lastSegment) return true;
      return name.toLowerCase().includes(lastSegment.toLowerCase());
    })
    .filter((name) => {
      const existing = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      return !existing.includes(name.toLowerCase());
    })
    .slice(0, 12);

  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <datalist id={listId}>
        {suggestions.map((name) => (
          <option key={name} value={prefix ? `${prefix}${name}` : name} />
        ))}
      </datalist>
    </>
  );
}
