"use strict";

const STATUS_GAP = 8;
const PANEL_GAP = 12;

function finiteNumber(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  return value;
}

function normalizeWorkArea(workArea) {
  if (!workArea || typeof workArea !== "object") {
    throw new TypeError("workArea is required");
  }
  const x = finiteNumber(workArea.x, "workArea.x");
  const y = finiteNumber(workArea.y, "workArea.y");
  const width = Math.max(0, finiteNumber(workArea.width, "workArea.width"));
  const height = Math.max(0, finiteNumber(workArea.height, "workArea.height"));
  return { x, y, width, height };
}

function normalizeHitRect(hitRect) {
  if (!hitRect || typeof hitRect !== "object") {
    throw new TypeError("hitRect is required");
  }
  const left = finiteNumber(hitRect.left, "hitRect.left");
  const top = finiteNumber(hitRect.top, "hitRect.top");
  const right = finiteNumber(hitRect.right, "hitRect.right");
  const bottom = finiteNumber(hitRect.bottom, "hitRect.bottom");
  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
  };
}

function normalizeSize(size, workArea, label) {
  if (!size || typeof size !== "object") throw new TypeError(`${label} is required`);
  const width = Math.max(0, finiteNumber(size.width, `${label}.width`));
  const height = Math.max(0, finiteNumber(size.height, `${label}.height`));
  return {
    width: Math.min(width, workArea.width),
    height: Math.min(height, workArea.height),
  };
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function clampBoundsToWorkArea(bounds, rawWorkArea) {
  const workArea = normalizeWorkArea(rawWorkArea);
  const size = normalizeSize(bounds, workArea, "bounds");
  return {
    x: Math.round(clamp(
      finiteNumber(bounds.x, "bounds.x"),
      workArea.x,
      workArea.x + workArea.width - size.width
    )),
    y: Math.round(clamp(
      finiteNumber(bounds.y, "bounds.y"),
      workArea.y,
      workArea.y + workArea.height - size.height
    )),
    width: Math.round(size.width),
    height: Math.round(size.height),
  };
}

function positionStatusPill({ hitRect: rawHitRect, workArea: rawWorkArea, pillSize, gap = STATUS_GAP }) {
  const workArea = normalizeWorkArea(rawWorkArea);
  const hitRect = normalizeHitRect(rawHitRect);
  const size = normalizeSize(pillSize, workArea, "pillSize");
  const safeGap = Math.max(0, finiteNumber(gap, "gap"));
  const workBottom = workArea.y + workArea.height;
  const aboveY = hitRect.top - safeGap - size.height;
  const belowY = hitRect.bottom + safeGap;
  const fitsAbove = aboveY >= workArea.y;
  const fitsBelow = belowY + size.height <= workBottom;

  let placement;
  let y;
  if (fitsAbove) {
    placement = "above";
    y = aboveY;
  } else if (fitsBelow) {
    placement = "below";
    y = belowY;
  } else {
    const spaceAbove = hitRect.top - workArea.y;
    const spaceBelow = workBottom - hitRect.bottom;
    placement = spaceAbove >= spaceBelow ? "above" : "below";
    y = placement === "above" ? aboveY : belowY;
  }

  const x = (hitRect.left + hitRect.right - size.width) / 2;
  return {
    ...clampBoundsToWorkArea({ x, y, ...size }, workArea),
    placement,
  };
}

function positionActivityPanel({
  hitRect: rawHitRect,
  workArea: rawWorkArea,
  panelSize,
  gap = PANEL_GAP,
  miniEdge = null,
}) {
  const workArea = normalizeWorkArea(rawWorkArea);
  const hitRect = normalizeHitRect(rawHitRect);
  const size = normalizeSize(panelSize, workArea, "panelSize");
  const safeGap = Math.max(0, finiteNumber(gap, "gap"));
  const workRight = workArea.x + workArea.width;
  const leftX = hitRect.left - safeGap - size.width;
  const rightX = hitRect.right + safeGap;
  const fitsLeft = leftX >= workArea.x;
  const fitsRight = rightX + size.width <= workRight;
  const leftSpace = hitRect.left - workArea.x;
  const rightSpace = workRight - hitRect.right;

  let placement;
  if (miniEdge === "right") {
    placement = "left";
  } else if (miniEdge === "left") {
    placement = "right";
  } else if (fitsLeft !== fitsRight) {
    placement = fitsLeft ? "left" : "right";
  } else {
    placement = leftSpace >= rightSpace ? "left" : "right";
  }

  const x = placement === "left" ? leftX : rightX;
  const hitCenterY = (hitRect.top + hitRect.bottom) / 2;
  const y = hitCenterY - size.height / 2;

  return {
    ...clampBoundsToWorkArea({ x, y, ...size }, workArea),
    placement,
  };
}

module.exports = {
  PANEL_GAP,
  STATUS_GAP,
  clampBoundsToWorkArea,
  positionActivityPanel,
  positionStatusPill,
};
