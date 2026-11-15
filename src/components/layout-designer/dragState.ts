export interface ActiveDragElement {
  elementType: string;
  extraData?: any;
}

let currentDragElement: ActiveDragElement | null = null;

export function setActiveDragElement(elem: ActiveDragElement | null) {
  currentDragElement = elem;
  if (typeof window !== 'undefined') {
    (window as any).__parkease_drag_elem__ = elem;
  }
}

export function getActiveDragElement(): ActiveDragElement | null {
  if (currentDragElement) return currentDragElement;
  if (typeof window !== 'undefined' && (window as any).__parkease_drag_elem__) {
    return (window as any).__parkease_drag_elem__;
  }
  return null;
}

