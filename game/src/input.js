// Keyboard and mouse intent, no game rules. Movement is a set of held flags; the vault is a
// press/release pair exposed as events so the loop decides what a press means in each phase.

const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function createInput(canvas) {
  const move = { up: false, down: false, left: false, right: false };
  const pointer = { x: 640, y: 360, active: false };
  const handlers = { vaultDown: [], vaultUp: [], confirm: [] };
  const held = new Set();
  let vaultHeld = false;

  const emit = (name) => {
    for (const fn of handlers[name]) fn();
  };
  const pressVault = () => {
    if (vaultHeld) return;
    vaultHeld = true;
    emit('vaultDown');
  };
  const releaseVault = () => {
    if (!vaultHeld) return;
    vaultHeld = false;
    emit('vaultUp');
  };
  const track = (event) => {
    const direction = MOVE_KEYS[event.code];
    if (!direction) return false;
    move[direction] = true;
    held.add(event.code);
    return true;
  };

  window.addEventListener('keydown', (event) => {
    if (track(event)) {
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'KeyJ') {
      event.preventDefault();
      if (!event.repeat) pressVault();
      return;
    }
    if (event.code === 'KeyR' || event.code === 'Enter') {
      event.preventDefault();
      if (!event.repeat) emit('confirm');
    }
  });

  window.addEventListener('keyup', (event) => {
    const direction = MOVE_KEYS[event.code];
    if (direction) {
      move[direction] = false;
      held.delete(event.code);
      return;
    }
    if (event.code === 'Space' || event.code === 'KeyJ') releaseVault();
  });

  const toCanvas = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 1280;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 720;
    pointer.active = true;
  };

  canvas.addEventListener('pointermove', toCanvas);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    toCanvas(event);
    canvas.setPointerCapture(event.pointerId);
    pressVault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) releaseVault();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // A held key must never survive focus loss, or the vault would stay open and stuck.
  window.addEventListener('blur', () => {
    for (const code of held) {
      const direction = MOVE_KEYS[code];
      if (direction) move[direction] = false;
    }
    held.clear();
    releaseVault();
  });

  return {
    move,
    pointer,
    on: (name, fn) => {
      handlers[name].push(fn);
    },
  };
}
