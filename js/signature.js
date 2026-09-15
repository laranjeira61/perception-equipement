// Capture de signature tactile/souris sur <canvas>
function initSignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastX = 0, lastY = 0;
  let hasSignature = false;
  let pendingLoad = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const toRestore = pendingLoad || (hasSignature ? canvas.toDataURL() : null);
    pendingLoad = null;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    if (toRestore && rect.width > 0 && rect.height > 0) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = toRestore;
    }
  }

  function pos(evt) {
    const rect = canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(evt) {
    evt.preventDefault();
    drawing = true;
    hasSignature = true;
    const p = pos(evt);
    lastX = p.x; lastY = p.y;
  }

  function move(evt) {
    if (!drawing) return;
    evt.preventDefault();
    const p = pos(evt);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }

  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  window.addEventListener('resize', resize);
  resize();

  return {
    clear() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      hasSignature = false;
      pendingLoad = null;
    },
    isEmpty() { return !hasSignature; },
    toDataURL() { return hasSignature ? canvas.toDataURL('image/png') : null; },
    loadDataURL(dataUrl) {
      if (!dataUrl) return;
      hasSignature = true;
      pendingLoad = dataUrl;
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) resize();
    },
    resize
  };
}
