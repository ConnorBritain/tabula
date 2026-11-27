// Pure storage/controller tests supply the ownership dependency explicitly. Browser tests use the actual native lock.
export const heldWriter = Object.freeze({ isHeld: () => true, assertHeld() {}, state: () => ({ status: 'held', held: true }) });
