import { useState, useRef, useCallback } from 'react';
import type { ViewState, DragState } from '../types';

export const useZoomPan = () => {
  const [viewState, setViewState] = useState<ViewState>({
    scale: 1,
    panX: 0,
    panY: 0
  });

  const dragRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
  });

  const resetViewState = useCallback(() => {
    dragRef.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0
    };
    
    setViewState({
      scale: 1,
      panX: 0,
      panY: 0
    });
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY * -0.01;
    const newScale = Math.min(Math.max(viewState.scale + delta, 1), 16);
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorXRelative = e.clientX - rect.left - rect.width / 2;
    const cursorYRelative = e.clientY - rect.top - rect.height / 2;
    
    const newPanX = viewState.panX + (cursorXRelative / viewState.scale) * (1 - newScale / viewState.scale);
    const newPanY = viewState.panY + (cursorYRelative / viewState.scale) * (1 - newScale / viewState.scale);
    
    setViewState({
      scale: newScale,
      panX: newPanX,
      panY: newPanY
    });
  }, [viewState]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: viewState.panX,
      startPanY: viewState.panY
    };
  }, [viewState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    
    const sensitivity = 0.5 / Math.sqrt(viewState.scale);
    const deltaX = (e.clientX - dragRef.current.startX) * sensitivity;
    const deltaY = (e.clientY - dragRef.current.startY) * sensitivity;
    
    setViewState(prev => ({
      ...prev,
      panX: dragRef.current.startPanX + deltaX,
      panY: dragRef.current.startPanY + deltaY
    }));
  }, [viewState.scale]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  return {
    viewState,
    setViewState,
    resetViewState,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}; 

