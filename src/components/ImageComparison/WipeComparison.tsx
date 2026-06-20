import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Loader2, MoveHorizontal } from "lucide-react";
import type { ComparisonPair, ViewState } from './types';
import { Slider } from "@/components/ui/slider";
import type { ReactElement } from 'react';

interface WipeComparisonProps {
  currentPair: ComparisonPair;
  viewState: ViewState;
  setViewState: (state: ViewState) => void;
  resetViewState: () => void;
  handleWheel: (e: WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  onSelection: (side: 'left' | 'right' | 'tie') => void;
  loadingImages: { left: boolean; right: boolean };
  handleImageLoad: (side: 'left' | 'right') => void;
  hasImageKeyword: (file: any, url: string, keyword: 'hair' | 'mask') => boolean;
  currentPairIndex: number;
  totalPairs: number;
  showOverlay: boolean;
  renderImage: (side: 'left' | 'right', isWipeMode?: boolean) => ReactElement;
}

export const WipeComparison = ({
  currentPair,
  viewState,
  setViewState,
  resetViewState,
  handleWheel,
  handleMouseDown,
  onSelection,
  loadingImages,
  handleImageLoad,
  hasImageKeyword,
  currentPairIndex,
  totalPairs,
  showOverlay,
  renderImage
}: WipeComparisonProps) => {
  const [wipePosition, setWipePosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isWipeDragging, setIsWipeDragging] = useState(false);

  // Handle mouse down with drag tracking for image panning
  const handleMouseDownWithDrag = (e: React.MouseEvent) => {
    if (!isWipeDragging) {
      setIsDragging(true);
      handleMouseDown(e);
    }
  };

  // Handle wipe line drag start
  const handleWipeDragStart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent image panning when dragging wipe line
    setIsWipeDragging(true);
  };

  // Handle wipe line drag
  const handleWipeDrag = (e: MouseEvent) => {
    if (isWipeDragging) {
      const container = (e.target as HTMLElement).closest('.relative.flex-1');
      if (container) {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setWipePosition(newPosition);
      }
    }
  };

  // Handle mouse up to reset drag states
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsWipeDragging(false);
  };

  // Handle direct click on container to set wipe position
  const handleContainerClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newPosition = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setWipePosition(newPosition);
    }
  };

  // Add effect to handle mouse move and up globally
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isWipeDragging) {
        handleWipeDrag(e);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isWipeDragging]);

  return (
    <div className="space-y-4">
      <Card className="h-[calc(100vh-400px)]">
        <CardContent className="p-2 h-full flex flex-col">
          <div className="flex justify-between items-center gap-2 mb-2">
            <div className="flex gap-2">
              <Badge 
                className={hasImageKeyword(currentPair.left.file, currentPair.left.url, 'hair') 
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"}
              >
                hair: {hasImageKeyword(currentPair.left.file, currentPair.left.url, 'hair') ? "on" : "off"}
              </Badge>
              <Badge 
                className={hasImageKeyword(currentPair.left.file, currentPair.left.url, 'mask') 
                  ? "bg-purple-500 hover:bg-purple-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"}
              >
                mask: {hasImageKeyword(currentPair.left.file, currentPair.left.url, 'mask') ? "on" : "off"}
              </Badge>
            </div>
            <div className="flex justify-end gap-2 flex-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewState({
                    ...viewState,
                    scale: Math.max(viewState.scale - 0.5, 1)
                  });
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewState({
                    ...viewState,
                    scale: Math.min(viewState.scale + 0.5, 16)
                  });
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Badge variant="secondary">
                {Math.round(viewState.scale * 100)}%
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={resetViewState}
                className="h-7 px-2"
              >
                Reset View
              </Button>
            </div>
          </div>

          <div 
            className="relative flex-1 overflow-hidden cursor-move rounded-lg select-none"
            onWheel={handleWheel as any}
            onMouseDown={handleMouseDownWithDrag}
            onClick={handleContainerClick}
          >
            {(loadingImages.left || loadingImages.right) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-50">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            
            {/* Base image (right) */}
            {renderImage('right', true)}

            {/* Container for left image and wipe effect */}
            {!isDragging && (
              <div className="absolute inset-0 overflow-hidden select-none" style={{ clipPath: `inset(0 ${100 - wipePosition}% 0 0)` }}>
                {renderImage('left', true)}
              </div>
            )}

            {/* Interactive vertical line indicator */}
            {!isDragging && (
              <div 
                className="absolute top-0 bottom-0 w-8 -ml-4 cursor-col-resize z-10 flex items-center justify-center hover:bg-primary/5 transition-colors select-none group"
                style={{
                  left: `${wipePosition}%`,
                }}
                onMouseDown={handleWipeDragStart}
              >
                <div className="w-0.5 h-full bg-primary/50" />
                <div className="absolute w-1 h-full bg-primary/20" />
                <div className="absolute w-0.5 h-full bg-primary" />
                <div className="absolute p-1.5 rounded-full bg-primary/90 text-white shadow-lg group-hover:scale-110 transition-transform">
                  <MoveHorizontal className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selection Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button 
          onClick={() => onSelection('left')}
          className="w-full"
          variant="default"
          disabled={loadingImages.left || loadingImages.right || currentPairIndex >= totalPairs}
          title={currentPairIndex >= totalPairs ? "All comparisons completed" : ""}
        >
          {currentPairIndex >= totalPairs ? (
            "Comparisons Complete"
          ) : (
            <>Select Left Image (<span className="ml-2 opacity-75">←</span>)</>
          )}
        </Button>

        <Button 
          onClick={() => onSelection('tie')}
          className="w-full"
          variant="outline"
          disabled={loadingImages.left || loadingImages.right || currentPairIndex >= totalPairs}
          title={currentPairIndex >= totalPairs ? "All comparisons completed" : ""}
        >
          {currentPairIndex >= totalPairs ? (
            "Comparisons Complete"
          ) : (
            <>Mark as Tie (<span className="ml-2 opacity-75">Space</span>)</>
          )}
        </Button>

        <Button 
          onClick={() => onSelection('right')}
          className="w-full"
          variant="default"
          disabled={loadingImages.left || loadingImages.right || currentPairIndex >= totalPairs}
          title={currentPairIndex >= totalPairs ? "All comparisons completed" : ""}
        >
          {currentPairIndex >= totalPairs ? (
            "Comparisons Complete"
          ) : (
            <>Select Right Image (<span className="ml-2 opacity-75">→</span>)</>
          )}
        </Button>
      </div>
    </div>
  );
}; 