import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DirectorySetup } from './DirectorySetup';
import { ComparisonInterface } from './ComparisonInterface';
import { useImageComparison } from './hooks/useImageComparison';
import { useZoomPan } from './hooks/useZoomPan';
import { Button } from "@/components/ui/button";
import type { ImageFile } from './types';

export const ImageComparison = () => {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [useScoreBlur, setUseScoreBlur] = useState(true);
  const [setupMode, setSetupMode] = useState<'preset' | 'local' | null>(null);
  const zoomPanState = useZoomPan();
  const {
    scores,
    directoryNames,
    imageFiles,
    currentPair,
    error,
    useMatchedPairs,
    currentPairIndex,
    totalPairs,
    setDirectoryNames,
    handleDirectorySetup,
    handleSelection,
    exportComparisons,
    setUseMatchedPairs,
    findMatchingPairs,
    setImageFiles,
    handleSubmit,
    usePersistentRatings,
    setUsePersistentRatings,
    selectedDirectories,
    getRating,
    comparisons,
    isSubmitted,
    currentStoredRatings,
    comparisonSetId,
    setComparisonSetId
  } = useImageComparison(zoomPanState);

  useEffect(() => {
    zoomPanState.resetViewState();
  }, [zoomPanState.resetViewState]);

  // Force disable persistent ratings in local mode
  useEffect(() => {
    if (setupMode === 'local') {
      setUsePersistentRatings(false);
    }
  }, [setupMode, setUsePersistentRatings]);

  const handleStart = () => {
    findMatchingPairs();
    setIsSetupComplete(true);
  };

  const isReadyToStart = imageFiles.v1.length > 0 && imageFiles.v2.length > 0;

  const setupDirectory = async (version: 'v1' | 'v2', files?: ImageFile[], directoryPath?: string) => {
    if (setupMode === 'local') {
      await handleDirectorySetup(version);
    } else if (setupMode === 'preset' && files) {
      await handleDirectorySetup(version, files, directoryPath);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Image Quality Assessment</CardTitle>
            <CardDescription>
              Compare and rate image quality with precision
            </CardDescription>
          </div>
          {!isSetupComplete && setupMode && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSetupMode(null);
                setComparisonSetId(null);
              }}
            >
              Change Mode
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isSetupComplete ? (
            <DirectorySetup
              imageFiles={imageFiles}
              directoryNames={directoryNames}
              useMatchedPairs={useMatchedPairs}
              useScoreBlur={useScoreBlur}
              onDirectorySetup={setupDirectory}
              onNameUpdate={(version, name) => 
                setDirectoryNames(prev => ({ ...prev, [version]: name }))
              }
              onModeChange={setUseMatchedPairs}
              onScoreBlurChange={setUseScoreBlur}
              onStart={handleStart}
              isReadyToStart={isReadyToStart}
              setupMode={setupMode}
              onSetupModeChange={setSetupMode}
              usePersistentRatings={usePersistentRatings}
              onPersistentRatingsChange={setUsePersistentRatings}
              selectedDirectories={selectedDirectories}
              onDirectoriesSelected={() => {}}
              onComparisonSetSelect={setComparisonSetId}
            />
          ) : (
            <ComparisonInterface
              zoomPanState={zoomPanState}
              currentPair={currentPair}
              scores={scores}
              directoryNames={directoryNames}
              comparisonSetId={comparisonSetId}
              onSelection={handleSelection}
              onExport={exportComparisons}
              getCSVContent={() => {
                const headers = [
                  'Timestamp',
                  'Winner',
                  'Winner Score',
                  'Loser',
                  'Loser Score',
                  'Winner File',
                  'Loser File'
                ];
                
                // Get final ratings for each directory
                const finalRatings = {
                  v1: getRating('v1'),
                  v2: getRating('v2')
                };
                
                return [
                  headers.join(','),
                  ...comparisons.map((comp, index) => {
                    // For the last comparison, use the final ratings
                    const isLastComparison = index === comparisons.length - 1;
                    const winnerScore = isLastComparison ? 
                      finalRatings[comp.winner === directoryNames.v1 ? 'v1' : 'v2'] :
                      comp.winnerScore;
                    const loserScore = isLastComparison ? 
                      finalRatings[comp.loser === directoryNames.v1 ? 'v1' : 'v2'] :
                      comp.loserScore;

                    return [
                      comp.timestamp,
                      comp.winner,
                      winnerScore,
                      comp.loser,
                      loserScore,
                      comp.winnerFile,
                      comp.loserFile
                    ].map(value => `"${value}"`).join(',');
                  })
                ].join('\n');
              }}
              currentPairIndex={currentPairIndex}
              totalPairs={totalPairs}
              useScoreBlur={useScoreBlur}
              onSubmit={handleSubmit}
              usePersistentRatings={usePersistentRatings}
              currentStoredRatings={currentStoredRatings}
              comparisons={comparisons}
              selectedDirectories={{
                v1: selectedDirectories.v1 || undefined,
                v2: selectedDirectories.v2 || undefined
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}; 