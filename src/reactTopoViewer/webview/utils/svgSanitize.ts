const SAFE_HREF_PREFIXES = [
  "#",
  "data:image/png",
  "data:image/jpeg",
  "data:image/jpg",
  "data:image/gif",
  "data:image/webp"
];

export function isSvgDataUri(dataUri: string): boolean {
  return dataUri.startsWith("data:image/svg+xml");
}

function isSafeHref(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return false;
  return SAFE_HREF_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function sanitizeSvgContent(svgString: string): string {
  if (!svgString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    if (doc.querySelector("parsererror")) return "";
    const svg = doc.querySelector("svg");
    if (!svg) return "";

    const unsafeTags = ["script", "foreignObject", "iframe", "object", "embed", "link"];
    for (const tag of unsafeTags) {
      svg.querySelectorAll(tag).forEach((node) => node.remove());
    }

    const elements = [svg, ...Array.from(svg.querySelectorAll("*"))];
    for (const el of elements) {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        const valueLower = value.toLowerCase();
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === "href" || name === "xlink:href") {
          if (!isSafeHref(value)) {
            el.removeAttribute(attr.name);
          }
          continue;
        }
        if (name === "style" && valueLower.includes("javascript:")) {
          el.removeAttribute(attr.name);
        }
      }
    }

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return "";
  }
}

function decodeSvgDataUri(dataUri: string): string {
  if (!isSvgDataUri(dataUri)) {
    return "";
  }
  const commaIndex = dataUri.indexOf(",");
  if (commaIndex === -1) return "";
  const meta = dataUri.slice(0, commaIndex);
  const data = dataUri.slice(commaIndex + 1);
  try {
    return meta.includes(";base64") ? atob(data) : decodeURIComponent(data);
  } catch {
    return "";
  }
}

export function decodeAndSanitizeSvgDataUri(dataUri: string): string {
  const decoded = decodeSvgDataUri(dataUri);
  return sanitizeSvgContent(decoded);
}

export function sanitizeSvgDataUri(dataUri: string): string {
  const sanitized = decodeAndSanitizeSvgDataUri(dataUri);
  if (!sanitized) return "";
  return `data:image/svg+xml,${encodeURIComponent(sanitized)}`;
}
