const DEFAULT_OBJECT_FRAME = Object.freeze({
  scaleW: 1.9,
  scaleH: 1.3,
  offX: -0.45,
  offY: -0.25,
});

function getObjRect(bounds, frame = DEFAULT_OBJECT_FRAME) {
  return {
    x: bounds.x + bounds.width * frame.offX,
    y: bounds.y + bounds.height * frame.offY,
    w: bounds.width * frame.scaleW,
    h: bounds.height * frame.scaleH,
  };
}

function getHitRectScreen(bounds, hitBox, frame = DEFAULT_OBJECT_FRAME) {
  const obj = getObjRect(bounds, frame);
  const scale = Math.min(obj.w, obj.h) / 45;
  const offsetX = obj.x + (obj.w - 45 * scale) / 2;
  const offsetY = obj.y + (obj.h - 45 * scale) / 2;

  return {
    left: offsetX + (hitBox.x + 15) * scale,
    top: offsetY + (hitBox.y + 25) * scale,
    right: offsetX + (hitBox.x + 15 + hitBox.w) * scale,
    bottom: offsetY + (hitBox.y + 25 + hitBox.h) * scale,
  };
}

module.exports = {
  DEFAULT_OBJECT_FRAME,
  getObjRect,
  getHitRectScreen,
};
