function groupAttrs({ id = "", className = "" } = {}) {
  return [id ? `id="${id}"` : "", className ? `class="${className}"` : ""]
    .filter(Boolean)
    .join(" ");
}

function wrapGroup(content, attrs = {}) {
  const attrString = groupAttrs(attrs);
  return `<g ${attrString}>${content}</g>`;
}

function buildEyes(kind = "default", attrs = {}) {
  const fill = "#3E2315";

  const variants = {
    default: `
      <rect x="4.1" y="7.7" width="1.6" height="2.6" rx="0.8" fill="${fill}" />
      <rect x="9.9" y="7.7" width="1.6" height="2.6" rx="0.8" fill="${fill}" />
    `,
    focused: `
      <rect x="4.2" y="7.8" width="1.4" height="2.8" rx="0.7" fill="${fill}" />
      <rect x="10.0" y="7.8" width="1.4" height="2.8" rx="0.7" fill="${fill}" />
    `,
    sleepy: `
      <rect x="3.6" y="8.8" width="2.7" height="1.1" rx="0.55" fill="${fill}" />
      <rect x="9.4" y="8.8" width="2.7" height="1.1" rx="0.55" fill="${fill}" />
    `,
    closed: `
      <rect x="3.7" y="8.9" width="3" height="0.8" rx="0.4" fill="${fill}" />
      <rect x="9.3" y="8.9" width="3" height="0.8" rx="0.4" fill="${fill}" />
    `,
    happy: `
      <path d="M3.9 9.4 Q5 8.2 6.1 9.4" stroke="${fill}" stroke-width="0.8" fill="none" stroke-linecap="round" />
      <path d="M9.7 9.4 Q10.8 8.2 11.9 9.4" stroke="${fill}" stroke-width="0.8" fill="none" stroke-linecap="round" />
    `,
    surprised: `
      <ellipse cx="5" cy="9" rx="1.2" ry="1.6" fill="${fill}" />
      <ellipse cx="10.8" cy="9" rx="1.2" ry="1.6" fill="${fill}" />
    `,
    annoyed: `
      <path d="M3.6 8.4 L6.5 7.9" stroke="${fill}" stroke-width="0.8" stroke-linecap="round" />
      <path d="M9.3 7.9 L12.2 8.4" stroke="${fill}" stroke-width="0.8" stroke-linecap="round" />
      <rect x="4.2" y="8.8" width="1.9" height="0.85" rx="0.4" fill="${fill}" />
      <rect x="9.8" y="8.8" width="1.9" height="0.85" rx="0.4" fill="${fill}" />
    `,
    drag: `
      <ellipse cx="4.9" cy="9.4" rx="1.25" ry="0.85" fill="${fill}" />
      <ellipse cx="10.7" cy="9.4" rx="1.25" ry="0.85" fill="${fill}" />
    `,
    alert: `
      <ellipse cx="5" cy="8.9" rx="1.1" ry="1.45" fill="${fill}" />
      <ellipse cx="10.8" cy="8.9" rx="1.1" ry="1.45" fill="${fill}" />
      <rect x="4" y="6.8" width="1.9" height="0.45" rx="0.2" fill="${fill}" opacity="0.65" />
      <rect x="9.8" y="6.8" width="1.9" height="0.45" rx="0.2" fill="${fill}" opacity="0.65" />
    `,
  };

  return wrapGroup((variants[kind] || variants.default).replace(/\n\s+/g, ""), attrs);
}

function buildMouth(kind = "neutral", attrs = {}) {
  const fill = "#7F4028";
  const stroke = "#7F4028";

  const variants = {
    none: "",
    neutral: `<rect x="5.6" y="11.1" width="3.7" height="0.95" rx="0.45" fill="${fill}" opacity="0.88" />`,
    tiny: `<rect x="6.1" y="11.15" width="2.7" height="0.8" rx="0.4" fill="${fill}" opacity="0.88" />`,
    smile: `<path d="M5.5 11.1 Q7.45 12.35 9.4 11.1" stroke="${stroke}" stroke-width="0.9" fill="none" stroke-linecap="round" />`,
    grin: `
      <path d="M5.3 11.05 Q7.45 12.55 9.6 11.05" stroke="${stroke}" stroke-width="0.95" fill="none" stroke-linecap="round" />
      <rect x="6.1" y="11.35" width="2.7" height="0.35" rx="0.15" fill="#FDEDEC" opacity="0.8" />
    `,
    frown: `<path d="M5.5 12.2 Q7.45 11 9.4 12.2" stroke="${stroke}" stroke-width="0.85" fill="none" stroke-linecap="round" />`,
    flat: `<rect x="5.4" y="11.35" width="4.1" height="0.7" rx="0.35" fill="${fill}" opacity="0.92" />`,
    open: `<ellipse cx="7.45" cy="11.7" rx="1.8" ry="1.35" fill="${fill}" opacity="0.92" />`,
    gasp: `<ellipse cx="7.45" cy="11.6" rx="1.25" ry="1.55" fill="${fill}" opacity="0.92" />`,
    sleep: `<path d="M5.8 11.45 Q7.45 12.15 9.1 11.45" stroke="${stroke}" stroke-width="0.75" fill="none" stroke-linecap="round" opacity="0.85" />`,
  };

  return wrapGroup((variants[kind] || variants.neutral).replace(/\n\s+/g, ""), attrs);
}

module.exports = {
  buildEyes,
  buildMouth,
};
