"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Download, Loader2, SplitSquareHorizontal, Move } from "lucide-react";
import { useZoomPan } from './hooks/useZoomPan';
import type { ComparisonPair } from './types';
import { ComparisonNameDialog } from './ComparisonNameDialog';
import { useRatingsStorage } from './hooks/useRatingsStorage';
import { RatingsHistogram } from './RatingsHistogram';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WipeComparison } from './WipeComparison';

interface ComparisonInterfaceProps {
  currentPair: ComparisonPair | null;
  scores: { v1: number; v2: number };
  directoryNames: { v1: string; v2: string };
  onSelection: (side: 'left' | 'right' | 'tie') => void;
  onExport: () => void;
  getCSVContent: () => string;
  currentPairIndex: number;
  totalPairs: number;
  useScoreBlur: boolean;
  onSubmit: () => Promise<any>;
  zoomPanState: ReturnType<typeof useZoomPan>;
  usePersistentRatings: boolean;
  currentStoredRatings: { v1: number | null; v2: number | null; };
  comparisons: Array<{
    winner: string;
    loser: string;
    winnerScore: number;
    loserScore: number;
    timestamp: string;
    winnerFile: string;
    loserFile: string;
  }>;
  selectedDirectories: { v1?: string; v2?: string } | null;
  comparisonSetId: string | null;
}

// Update the MIN_COMPARISONS constant to be dynamic
const getMinComparisons = (totalPairs: number) => {
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    return Math.min(Number(process.env.NEXT_PUBLIC_MIN_COMPARISONS || '2'), totalPairs);
  }
  return Math.min(25, totalPairs);
};

// Helper function to generate CSV from comparisons
const generateCSVFromComparisons = (comparisons: Array<{
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  timestamp: string;
  winnerFile: string;
  loserFile: string;
}>) => {
  const header = 'Timestamp,Winner,Winner Score,Loser,Loser Score,Winner File,Loser File';
  const rows = comparisons.map(comp => 
    `"${comp.timestamp}","${comp.winner}","${comp.winnerScore}","${comp.loser}","${comp.loserScore}","${comp.winnerFile}","${comp.loserFile}"`
  );
  return [header, ...rows].join('\n');
};

export const ComparisonInterface = ({
  currentPair,
  scores,
  directoryNames,
  onSelection,
  onExport,
  getCSVContent,
  zoomPanState,
  currentPairIndex,
  totalPairs,
  useScoreBlur,
  onSubmit,
  usePersistentRatings,
  currentStoredRatings,
  comparisons,
  selectedDirectories,
  comparisonSetId
}: ComparisonInterfaceProps) => {
  const router = useRouter();
  const {
    viewState,
    setViewState,
    resetViewState,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = zoomPanState;

  const [showNameDialog, setShowNameDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const { loadStoredRatings } = useRatingsStorage();
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'wipe'>('side-by-side');

  const [loadingImages, setLoadingImages] = useState({ left: true, right: true });
  const [allStoredRatings, setAllStoredRatings] = useState<Array<{
    directoryPath: string;
    rating: number;
    totalComparisons: number;
    lastUpdated: string;
  }>>([]);

  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onSelection('left');
      } else if (e.key === 'ArrowRight') {
        onSelection('right');
      } else if (e.key === ' ') { // Space key for tie
        onSelection('tie');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onSelection]);

  // Add this function to determine if scores should be visible
  const shouldShowScores = (index: number) => {
    if (!useScoreBlur) return true;
    return (index + 1) % 10 === 0 || index === 0;
  };

  // Load stored ratings on mount only
  useEffect(() => {
    let mounted = true;

    const loadRatings = async () => {
      try {
        // Only load ratings if using persistent ratings
        if (usePersistentRatings) {
          const ratings = await loadStoredRatings();
          if (mounted) {
            setAllStoredRatings(ratings.personal);
          }
        }
      } catch (error) {
        console.error('Error loading ratings:', error);
      }
    };

    loadRatings();

    return () => {
      mounted = false;
    };
  }, [usePersistentRatings]); // Add usePersistentRatings to dependencies

  const handleSubmitClick = async () => {
    try {
      setIsSubmitting(true);
      setSubmissionError(null);

      // Check if user is authenticated before trying to save to database
      const authCheckResponse = await fetch('/api/auth/check');
      const { authenticated } = await authCheckResponse.json();

      // Create results data object
      const resultsData = {
        directoryV1: selectedDirectories?.v1 || 'unknown',
        directoryV2: selectedDirectories?.v2 || 'unknown',
        directoryNameV1: directoryNames.v1,
        directoryNameV2: directoryNames.v2,
        scoreV1: scores.v1,
        scoreV2: scores.v2,
        totalComparisons: comparisons.length,
        detailedResults: getCSVContent(),
        usePersistentRatings,
        authenticated // Add authentication status to results data
      };

      // Save comparison results only if user is authenticated
      if (authenticated && comparisons.length > 0) {
        try {
          // Save to database
          const response = await fetch('/api/comparisons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resultsData),
          });

          if (!response.ok) {
            throw new Error('Failed to save comparison results');
          }
        } catch (error) {
          console.error('Failed to save comparison results:', error);
          setSubmissionError('Failed to save comparison results');
          // Continue with redirection even if saving fails
        }
      }

      // Submit the ratings if using persistent ratings and user is authenticated
      if (authenticated && usePersistentRatings) {
        await onSubmit();
      }
      
      // Redirect to results page with data
      router.push(`/comparison/results?data=${encodeURIComponent(JSON.stringify(resultsData))}`);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit ratings');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to get the final rating for a directory
  const getRating = (version: 'v1' | 'v2'): number => {
    // Always use the final score from the scores object
    return scores[version];
  };

  // Function to normalize directory paths
  const normalizeDirectoryPath = (path: string): string => {
    return path.endsWith('/') ? path : `${path}/`;
  };

  // Function to handle image load
  const handleImageLoad = (side: 'left' | 'right') => {
    setLoadingImages(prev => ({ ...prev, [side]: false }));
  };

  // Reset loading state when currentPair changes
  useEffect(() => {
    if (currentPair) {
      setLoadingImages({ left: true, right: true });
    }
  }, [currentPair]);

  // Function to check if filename contains "_hair" or "_mask"
  const hasImageKeyword = (file: { name: string } | null, url: string, keyword: 'hair' | 'mask') => {
    if (file?.name) {
      return file.name.toLowerCase().includes(`_${keyword}`);
    }
    // For cloud files, check the URL
    return url.toLowerCase().includes(`_${keyword}`);
  };

  // Function to get a friendly name for a directory
  const getDirectoryDisplayName = (path: string) => {
    // For v1 directory
    if (path === selectedDirectories?.v1) {
      return directoryNames.v1;
    }
    // For v2 directory
    if (path === selectedDirectories?.v2) {
      return directoryNames.v2;
    }
    // For other directories, just clean up the path
    return path.endsWith('/') ? path.slice(0, -1) : path;
  };

  // Calculate minimum comparisons based on total pairs
  const minComparisons = getMinComparisons(totalPairs);

  // Function to save CSV data
  const saveComparisonCSV = async (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleViewHistory = () => {
    router.push('/dashboard/comparisons');
  };

  const renderImage = (side: 'left' | 'right', isWipeMode: boolean = false) => {
    const image = currentPair![side];
    const isMask = image.isMask;
    const hasReference = !!image.referenceUrl;

    return (
      <div className="relative w-full h-full">
        {loadingImages[side] && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-50">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        <img
          src={image.url}
          alt={`${side} comparison`}
          className={`absolute w-full h-full object-contain transition-transform ${isWipeMode ? 'select-none' : ''}`}
          style={{
            transform: `scale(${viewState.scale}) translate(${viewState.panX}px, ${viewState.panY}px)`,
            transformOrigin: 'center',
            pointerEvents: 'none',
            opacity: loadingImages[side] ? 0 : 1
          }}
          onLoad={() => handleImageLoad(side)}
        />
        {isMask && hasReference && showOverlay && (
          <img
            src={image.referenceUrl}
            alt={`${side} reference`}
            className={`absolute w-full h-full object-contain transition-transform ${isWipeMode ? 'select-none' : ''}`}
            style={{
              transform: `scale(${viewState.scale}) translate(${viewState.panX}px, ${viewState.panY}px)`,
              transformOrigin: 'center',
              pointerEvents: 'none',
              opacity: 0.5
            }}
          />
        )}
      </div>
    );
  };

  if (!currentPair) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Top row with scores and progress */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {!usePersistentRatings && (
            <div className="flex items-center gap-2">
              <span className="font-medium">{directoryNames.v1}</span>
              <Badge 
                variant="secondary"
                className={shouldShowScores(currentPairIndex) ? "" : "blur-sm hover:blur-none transition-all"}
                title={shouldShowScores(currentPairIndex) ? undefined : "Score hidden to prevent bias"}
              >
                {scores.v1}
              </Badge>
            </div>
          )}
          {usePersistentRatings && (
            <div className="flex items-center gap-2">
              <span className="font-medium">{directoryNames.v1}</span>
              <Badge 
                variant="secondary"
                className={shouldShowScores(currentPairIndex) ? "" : "blur-sm hover:blur-none transition-all"}
                title={shouldShowScores(currentPairIndex) ? undefined : "Score hidden to prevent bias"}
              >
                {scores.v1}
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium">{directoryNames.v2}</span>
            <Badge 
              variant="secondary"
              className={shouldShowScores(currentPairIndex) ? "" : "blur-sm hover:blur-none transition-all"}
              title={shouldShowScores(currentPairIndex) ? undefined : "Score hidden to prevent bias"}
            >
              {scores.v2}
            </Badge>
          </div>
          <Badge variant="outline">
            Progress: {Math.min(currentPairIndex + 1, totalPairs)} of {totalPairs}
          </Badge>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const filename = `comparison_${new Date().toISOString().split('T')[0]}`;
                const content = getCSVContent();
                const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${filename}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleSubmitClick}
              variant="default"
              size="sm"
              disabled={currentPairIndex < minComparisons || isSubmitting}
              title={currentPairIndex < minComparisons ? 
                `Complete at least ${minComparisons} comparisons to submit` : 
                usePersistentRatings ? "Submit results and update global ratings" : "Complete session without updating global ratings"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                usePersistentRatings ? "Submit Results" : "Complete Session"
              )}
            </Button>
          </div>
          {currentPairIndex < minComparisons && (
            <div className="text-xs text-muted-foreground">
              Complete at least {minComparisons} comparisons to {usePersistentRatings ? "submit" : "finish"}
            </div>
          )}
        </div>
      </div>

      {/* Second row with mode switch and tip */}
      <div className="flex justify-between items-center border-t pt-4">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            💡 Tip: {comparisonMode === 'side-by-side' 
              ? "Scroll on an image to zoom in/out, click and drag to pan the images"
              : "Use the slider to reveal/hide portions of each image, scroll to zoom, and drag to pan"}
          </span>
          {currentPair && (currentPair.left.isMask || currentPair.right.isMask) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOverlay(!showOverlay)}
              className="gap-2 border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white"
            >
              {showOverlay ? "Hide Reference" : "Show Reference"}
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setComparisonMode(mode => mode === 'side-by-side' ? 'wipe' : 'side-by-side')}
          className="gap-2"
        >
          {comparisonMode === 'side-by-side' ? (
            <>
              <Move className="h-4 w-4" />
              Switch to Wipe Mode
            </>
          ) : (
            <>
              <SplitSquareHorizontal className="h-4 w-4" />
              Switch to Side by Side
            </>
          )}
        </Button>
      </div>

      {comparisonMode === 'side-by-side' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[calc(100vh-400px)]">
            {/* Left Image */}
            <Card className="h-full">
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
                        setViewState(prev => ({
                          ...prev,
                          scale: Math.max(prev.scale - 0.5, 1)
                        }));
                      }}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewState(prev => ({
                          ...prev,
                          scale: Math.min(prev.scale + 0.5, 16)
                        }));
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
                  className="relative flex-1 overflow-hidden cursor-move rounded-lg"
                  onWheel={handleWheel as any}
                  onMouseDown={handleMouseDown}
                >
                  {renderImage('left')}
                </div>
              </CardContent>
            </Card>

            {/* Right Image */}
            <Card className="h-full">
              <CardContent className="p-2 h-full flex flex-col">
                <div className="flex justify-between items-center gap-2 mb-2">
                  <div className="flex gap-2">
                    <Badge 
                      className={hasImageKeyword(currentPair.right.file, currentPair.right.url, 'hair') 
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"}
                    >
                      hair: {hasImageKeyword(currentPair.right.file, currentPair.right.url, 'hair') ? "on" : "off"}
                    </Badge>
                    <Badge 
                      className={hasImageKeyword(currentPair.right.file, currentPair.right.url, 'mask') 
                        ? "bg-purple-500 hover:bg-purple-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"}
                    >
                      mask: {hasImageKeyword(currentPair.right.file, currentPair.right.url, 'mask') ? "on" : "off"}
                    </Badge>
                  </div>
                  <div className="flex justify-end gap-2 flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewState(prev => ({
                          ...prev,
                          scale: Math.max(prev.scale - 0.5, 1)
                        }));
                      }}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewState(prev => ({
                          ...prev,
                          scale: Math.min(prev.scale + 0.5, 16)
                        }));
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
                  className="relative flex-1 overflow-hidden cursor-move rounded-lg"
                  onWheel={handleWheel as any}
                  onMouseDown={handleMouseDown}
                >
                  {renderImage('right')}
                </div>
              </CardContent>
            </Card>
          </div>

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
      ) : (
        <div className="h-[calc(100vh-300px)]">
          <WipeComparison
            currentPair={currentPair}
            viewState={viewState}
            setViewState={setViewState}
            resetViewState={resetViewState}
            handleWheel={handleWheel}
            handleMouseDown={handleMouseDown}
            onSelection={onSelection}
            loadingImages={loadingImages}
            handleImageLoad={handleImageLoad}
            hasImageKeyword={hasImageKeyword}
            currentPairIndex={currentPairIndex}
            totalPairs={totalPairs}
            showOverlay={showOverlay}
            renderImage={renderImage}
          />
        </div>
      )}

      {showNameDialog && (
        <ComparisonNameDialog
          open={showNameDialog}
          onClose={() => setShowNameDialog(false)}
          onSubmit={handleSubmitClick}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};