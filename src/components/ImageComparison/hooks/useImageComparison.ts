declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }
  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
  }
}

import { useState, useCallback, useEffect } from 'react';
import type { DirectoryState, ComparisonPair, ImageFile } from '../types';
import { useZoomPan } from './useZoomPan';
import { useBradleyTerry } from './useBradleyTerry';
import { useRatingsStorage } from './useRatingsStorage';

interface Rating {
  directoryPath: string;
  rating: number;
  totalComparisons: number;
  lastUpdated: string;
  totalUsers?: number;
}

interface RatingsData {
  personal: Rating[];
  global: Rating[];
}

// Fisher-Yates shuffle algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Generate all possible pairs
const generateAllPossiblePairs = (v1Files: ImageFile[], v2Files: ImageFile[]): Array<{ v1: ImageFile; v2: ImageFile }> => {
  const pairs: Array<{ v1: ImageFile; v2: ImageFile }> = [];
  v1Files.forEach(v1File => {
    v2Files.forEach(v2File => {
      pairs.push({ v1: v1File, v2: v2File });
    });
  });
  return shuffleArray(pairs);
};

export const useImageComparison = (zoomPanState: ReturnType<typeof useZoomPan>) => {
  const { resetViewState } = zoomPanState;
  const {
    ratings,
    updateRatings,
    updateRatingsWithTie,
    getRating,
    getConfidenceInterval,
    initializeRating,
    setInitialRating
  } = useBradleyTerry();

  const { loadStoredRatings, updateStoredRatings } = useRatingsStorage();

  const scores = {
    v1: Math.round(getRating('v1')),
    v2: Math.round(getRating('v2'))
  };

  const [directoryNames, setDirectoryNames] = useState({ v1: 'v1', v2: 'v2' });
  const [imageFiles, setImageFiles] = useState<DirectoryState>({ v1: [], v2: [] });
  const [currentPair, setCurrentPair] = useState<ComparisonPair | null>(null);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useMatchedPairs, setUseMatchedPairs] = useState(true);
  const [pairs, setPairs] = useState<Array<{ v1: ImageFile; v2: ImageFile }>>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [usePersistentRatings, setUsePersistentRatings] = useState(true);
  const [currentStoredRatings, setCurrentStoredRatings] = useState<{
    v1: number | null;
    v2: number | null;
  }>({ v1: null, v2: null });

  const BATCH_SIZE = 25;

  const [selectedDirectories, setSelectedDirectories] = useState<{
    v1: string | null;
    v2: string | null;
  }>({ v1: null, v2: null });

  const [comparisonSetId, setComparisonSetId] = useState<string | null>(null);

  useEffect(() => {
    const initializeRatings = async () => {
      try {
        // Always initialize to 1000/1000
        setInitialRating('v1', 1000);
        setInitialRating('v2', 1000);

        // If using persistent ratings, load current stored ratings for display after submission
        if (usePersistentRatings && (selectedDirectories.v1 || selectedDirectories.v2)) {
          const storedRatings = await loadStoredRatings();

          const v1Rating = storedRatings.personal.find(r => r.directoryPath === selectedDirectories.v1)?.rating ?? null;
          const v2Rating = storedRatings.personal.find(r => r.directoryPath === selectedDirectories.v2)?.rating ?? null;

          setCurrentStoredRatings({
            v1: v1Rating,
            v2: v2Rating
          });
        }
      } catch (error) {
        console.error('=== END initializeRatings - Error ===', error);
        setInitialRating('v1', 1000);
        setInitialRating('v2', 1000);
      }
    };

    initializeRatings();
  }, [selectedDirectories, usePersistentRatings]);

  const handleDirectorySetup = async (version: 'v1' | 'v2', presetFiles?: ImageFile[], directoryPath?: string) => {
    try {
      if (presetFiles) {
        // For cloud files
        setImageFiles(prev => ({ ...prev, [version]: presetFiles }));
        if (directoryPath) {
          setSelectedDirectories(prev => ({ ...prev, [version]: directoryPath }));
        }
        setError(null);
        return;
      }

      // For local files
      const dirHandle = await window.showDirectoryPicker();
      const files: ImageFile[] = [];
      
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const url = URL.createObjectURL(file);
          files.push({
            file,
            name: entry.name,
            url
          });
        }
      }

      // Set the directory path for local files using the directory name
      const localDirectoryPath = `local/${dirHandle.name}`;
      setSelectedDirectories(prev => ({ ...prev, [version]: localDirectoryPath }));
      setImageFiles(prev => ({ ...prev, [version]: files }));
      setError(null);
    } catch (err) {
      setError(`Error loading directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const findMatchingPairs = useCallback(() => {
    if (imageFiles.v1.length === 0 || imageFiles.v2.length === 0) {
      setError('Please select both directories first');
      return;
    }

    let allPairs = [];
    
    // Check if we're dealing with mask images by looking at directory names
    const isMaskComparison = selectedDirectories.v1?.toLowerCase().includes('mask') || 
                           selectedDirectories.v2?.toLowerCase().includes('mask');
    
    if (useMatchedPairs) {
      // First, collect all matching pairs
      allPairs = imageFiles.v1.reduce((acc, v1File) => {
        const v1Name = v1File.name.split('/').pop()?.split('.')[0] || '';
        const matchingV2File = imageFiles.v2.find(v2File => {
          const v2Name = v2File.name.split('/').pop()?.split('.')[0] || '';
          return v2Name === v1Name;
        });

        if (matchingV2File) {
          // If this is a mask comparison, only include pairs where both files contain "mask"
          if (isMaskComparison) {
            if (v1File.name.toLowerCase().includes('mask') && matchingV2File.name.toLowerCase().includes('mask')) {
              acc.push({ v1: v1File, v2: matchingV2File });
            }
          } else {
            acc.push({ v1: v1File, v2: matchingV2File });
          }
        }
        return acc;
      }, [] as Array<{ v1: ImageFile; v2: ImageFile }>);

      // Use Fisher-Yates shuffle
      allPairs = shuffleArray(allPairs);
    } else {
      // Generate all possible combinations and shuffle them
      allPairs = generateAllPossiblePairs(imageFiles.v1, imageFiles.v2);
      
      // If this is a mask comparison, filter to only include pairs where both files contain "mask"
      if (isMaskComparison) {
        allPairs = allPairs.filter(pair => 
          pair.v1.name.toLowerCase().includes('mask') && 
          pair.v2.name.toLowerCase().includes('mask')
        );
      }
      
      // If we want to limit the number of pairs
      const maxPairs = Math.min(imageFiles.v1.length * imageFiles.v2.length, 100); // Limit to 100 pairs
      allPairs = allPairs.slice(0, maxPairs);
    }

    if (allPairs.length === 0) {
      setError(useMatchedPairs ? 'No matching pairs found' : 'No images available for comparison');
      return;
    }

    // Get the current batch of pairs
    const start = currentPairIndex * BATCH_SIZE;
    const currentBatch = allPairs.slice(start, start + BATCH_SIZE);

    setPairs(allPairs);
    setCurrentPairIndex(0);
    showNextPair(currentBatch[0]);
  }, [imageFiles, useMatchedPairs, currentPairIndex, selectedDirectories]);

  const findReferenceImage = (maskFile: ImageFile, allFiles: ImageFile[]): ImageFile | undefined => {
    // Get the base name without "_mask" and extension
    const baseName = maskFile.name.replace('_mask', '').split('.')[0];
    return allFiles.find(file => 
      file.name.split('.')[0] === baseName && 
      !file.name.includes('_mask')
    );
  };

  const showNextPair = useCallback((pair: { v1: ImageFile; v2: ImageFile }) => {
    const isLeftV1 = Math.random() < 0.5;
    
    // Find reference images if these are masks
    const v1Reference = pair.v1.name.includes('_mask') ? findReferenceImage(pair.v1, imageFiles.v1) : undefined;
    const v2Reference = pair.v2.name.includes('_mask') ? findReferenceImage(pair.v2, imageFiles.v2) : undefined;

    setCurrentPair({
      left: {
        version: isLeftV1 ? 'v1' : 'v2',
        url: isLeftV1 ? pair.v1.url! : pair.v2.url!,
        file: isLeftV1 ? pair.v1 : pair.v2,
        referenceUrl: isLeftV1 ? v1Reference?.url : v2Reference?.url,
        isMask: isLeftV1 ? pair.v1.name.includes('_mask') : pair.v2.name.includes('_mask')
      },
      right: {
        version: isLeftV1 ? 'v2' : 'v1',
        url: isLeftV1 ? pair.v2.url! : pair.v1.url!,
        file: isLeftV1 ? pair.v2 : pair.v1,
        referenceUrl: isLeftV1 ? v2Reference?.url : v1Reference?.url,
        isMask: isLeftV1 ? pair.v2.name.includes('_mask') : pair.v1.name.includes('_mask')
      }
    });
    resetViewState(); 
  }, [imageFiles]);

  const handleSelection = useCallback((side: 'left' | 'right' | 'tie') => {
    if (currentPairIndex >= pairs.length || !currentPair) {
      return;
    }

    setIsTransitioning(true);

    if (side === 'tie') {
      // Handle tie case
      const v1Version = currentPair.left.version as 'v1' | 'v2';
      const v2Version = currentPair.right.version as 'v1' | 'v2';
      const v1File = currentPair.left.file;
      const v2File = currentPair.right.file;
      const v1Score = getRating(v1Version);
      const v2Score = getRating(v2Version);

      // Record the tie
      setComparisons(prev => [...prev, {
        winner: directoryNames[v1Version],
        loser: directoryNames[v2Version],
        winnerScore: v1Score,
        loserScore: v2Score,
        timestamp: new Date().toISOString(),
        winnerFile: v1File.name || 'unknown',
        loserFile: v2File.name || 'unknown',
        isTie: true
      }]);

      // Update ratings for tie
      updateRatingsWithTie(v1Version, v2Version);
    } else {
      // Handle winner/loser case (existing code)
      const selectedVersion = (side === 'left' ? currentPair.left.version : currentPair.right.version) as 'v1' | 'v2';
      const winner = selectedVersion;
      const loser = selectedVersion === 'v1' ? 'v2' : 'v1';
      const winnerFile = side === 'left' ? currentPair.left.file : currentPair.right.file;
      const loserFile = side === 'left' ? currentPair.right.file : currentPair.left.file;
      const winnerScore = getRating(winner);
      const loserScore = getRating(loser);

      // Record the comparison
      setComparisons(prev => [...prev, {
        winner: directoryNames[winner],
        loser: directoryNames[loser],
        winnerScore,
        loserScore,
        timestamp: new Date().toISOString(),
        winnerFile: winnerFile.name || 'unknown',
        loserFile: loserFile.name || 'unknown'
      }]);

      // Update ratings with the correct versions
      updateRatings(winner, loser);
    }

    // Move to next pair
    const nextIndex = currentPairIndex + 1;
    setCurrentPairIndex(nextIndex);

    if (nextIndex < pairs.length) {
      const nextPair = pairs[nextIndex];
      const isLeftV1 = Math.random() < 0.5;
      
      // Find reference images for the next pair
      const v1Reference = nextPair.v1.name.includes('_mask') ? findReferenceImage(nextPair.v1, imageFiles.v1) : undefined;
      const v2Reference = nextPair.v2.name.includes('_mask') ? findReferenceImage(nextPair.v2, imageFiles.v2) : undefined;

      setCurrentPair({
        left: {
          version: isLeftV1 ? 'v1' : 'v2',
          url: isLeftV1 ? nextPair.v1.url! : nextPair.v2.url!,
          file: isLeftV1 ? nextPair.v1 : nextPair.v2,
          referenceUrl: isLeftV1 ? v1Reference?.url : v2Reference?.url,
          isMask: isLeftV1 ? nextPair.v1.name.includes('_mask') : nextPair.v2.name.includes('_mask')
        },
        right: {
          version: isLeftV1 ? 'v2' : 'v1',
          url: isLeftV1 ? nextPair.v2.url! : nextPair.v1.url!,
          file: isLeftV1 ? nextPair.v2 : nextPair.v1,
          referenceUrl: isLeftV1 ? v2Reference?.url : v1Reference?.url,
          isMask: isLeftV1 ? nextPair.v2.name.includes('_mask') : nextPair.v1.name.includes('_mask')
        }
      });
    }

    // Reset zoom/pan state for next pair
    resetViewState();

    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [currentPair, currentPairIndex, pairs, directoryNames, getRating, updateRatings, updateRatingsWithTie, resetViewState, imageFiles]);

  const exportComparisons = useCallback(() => {
    if (comparisons.length === 0) {
      setError('No comparisons to export');
      return;
    }

    try {
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
      
      const csvContent = [
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

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `image-comparisons-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(`Error exporting comparisons: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [comparisons, getRating, directoryNames]);

  const handleSubmit = async () => {
    // Calculate minimum comparisons based on total pairs available
    // For comparison sets with fewer than 25 images, we use the actual number of pairs
    // This ensures that ratings are updated even for small comparison sets
    const minComparisons = process.env.NEXT_PUBLIC_DEV_MODE === 'true' 
      ? Math.min(Number(process.env.NEXT_PUBLIC_MIN_COMPARISONS || '2'), pairs.length)
      : Math.min(25, pairs.length);

    if (currentPairIndex >= minComparisons) {
      try {
        if (usePersistentRatings && selectedDirectories.v1 && selectedDirectories.v2) {
          const v1Rating = getRating('v1');
          const v2Rating = getRating('v2');
          
          // Count actual comparisons for each directory
          const v1Comparisons = comparisons.filter(comp => 
            comp.winner === directoryNames.v1 || comp.loser === directoryNames.v1
          ).length;
          
          const v2Comparisons = comparisons.filter(comp => 
            comp.winner === directoryNames.v2 || comp.loser === directoryNames.v2
          ).length;

          const product = selectedDirectories.v1.split('/')[1];
          // Convert comparisonSetId to undefined if null
          const effectiveComparisonSetId = comparisonSetId || undefined;

          // First update v1 rating
          const v1Success = await updateStoredRatings(
            selectedDirectories.v1,
            v1Rating,
            v1Comparisons,
            undefined,  // No other updates for first call
            effectiveComparisonSetId,  // Pass comparisonSetId directly
            product
          );

          // Then update v2 rating
          const v2Success = await updateStoredRatings(
            selectedDirectories.v2,
            v2Rating,
            v2Comparisons,
            undefined,  // No other updates for second call
            effectiveComparisonSetId,  // Pass comparisonSetId directly
            product
          );

          if (v1Success && v2Success) {
            // Get the latest ratings after update
            const latestRatings = await loadStoredRatings();

            // Update the current stored ratings for display
            setCurrentStoredRatings({
              v1: latestRatings.personal.find(r => r.directoryPath === selectedDirectories.v1)?.rating ?? v1Rating,
              v2: latestRatings.personal.find(r => r.directoryPath === selectedDirectories.v2)?.rating ?? v2Rating
            });

            setCurrentPair(null);
            setIsSubmitted(true);
            return latestRatings;
          }
        }
      } catch (error) {
        console.error('=== END handleSubmit - Error ===', error);
        setError('Failed to save ratings');
        throw error;
      }
    }
    return { personal: [], global: [] };
  };

  return {
    scores,
    directoryNames,
    imageFiles,
    currentPair,
    error,
    useMatchedPairs,
    currentPairIndex,
    totalPairs: pairs.length,
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
    setSelectedDirectories,
    getRating,
    comparisons,
    isSubmitted,
    currentStoredRatings,
    comparisonSetId,
    setComparisonSetId
  };
};