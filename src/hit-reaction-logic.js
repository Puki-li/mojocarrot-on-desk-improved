(function initHitReactionLogic(global) {
  const FACE_REACT_RECT = Object.freeze({
    left: 15,
    right: 30,
    top: 20,
    bottom: 38,
  });

  function projectClientToObject(clientX, clientY, width, height, hitBox) {
    if (!hitBox || width <= 0 || height <= 0) return null;

    return {
      x: hitBox.x + 15 + (clientX / width) * hitBox.w,
      y: hitBox.y + 25 + (clientY / height) * hitBox.h,
    };
  }

  function getFaceReactionDirection(clientX, clientY, width, height, hitBox) {
    const point = projectClientToObject(clientX, clientY, width, height, hitBox);
    if (!point) return null;

    if (
      point.x < FACE_REACT_RECT.left ||
      point.x > FACE_REACT_RECT.right ||
      point.y < FACE_REACT_RECT.top ||
      point.y > FACE_REACT_RECT.bottom
    ) {
      return null;
    }

    const midX = (FACE_REACT_RECT.left + FACE_REACT_RECT.right) / 2;
    return point.x < midX ? "left" : "right";
  }

  const api = {
    FACE_REACT_RECT,
    projectClientToObject,
    getFaceReactionDirection,
  };

  global.ClawdHitReactionLogic = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
