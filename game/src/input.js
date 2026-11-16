// Keyboard and mouse. The vault is held (mouse button, Space or J) and released to fire, so both
// halves of the mechanic are one pair of actions a player can learn in a second.

const MOVE_KEYS = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

export function createInput(canvas) {
  const move = { left: false, right: false, up: false, down: false };
  const listeners = { vaultDown: [], vaultUp: [], confirm: [] };
  let holding = false;

  const emit = (name, arg) => {
    for (const fn of listeners[name]) fn(arg);
  };

  const pressVault = () => {
    if (holding) return;
    holding = true;
    emit('vaultDown');
  };

  const releaseVault = () => {
    if (!holding) return;
    holding = false;
    emit('vaultUp');
  };

  const onKeyDown = (event) => {
    if (MOVE_KEYS[event.code]) {
      move[MOVE_KEYS[event.code]] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'KeyJ') {
      event.preventDefault();
      if (!event.repeat) pressVault();
      return;
    }
    if (event.code === 'Enter' || event.code === 'KeyR') {
      event.preventDefault();
      if (!event.repeat) emit('confirm', event.code);
    }
  };

  const onKeyUp = (event) => {
    if (MOVE_KEYS[event.code]) {
      move[MOVE_KEYS[event.code]] = false;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'KeyJ') {
      event.preventDefault();
      releaseVault();
    }
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    canvas.setPointerCapture?.(event.pointerId);
    pressVault();
  };

  const onPointerUp = (event) => {
    if (event.button !== 0) return;
    releaseVault();
  };

  // A window that loses focus mid-hold would otherwise leave the vault stuck open.
  const onBlur = () => {
    move.left = move.right = move.up = move.down = false;
    releaseVault();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    move,
    isHolding: () => holding,
    on(name, fn) {
      listeners[name].push(fn);
    },
  };
}
