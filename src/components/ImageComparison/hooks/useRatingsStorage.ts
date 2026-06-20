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
  comparisonSets: unknown[];
}

/**
 * Persists/loads ratings via the server `/api/ratings` route. All S3 access lives
 * on the server — this hook only talks to our own API.
 */
export const useRatingsStorage = () => {
  const loadStoredRatings = async (): Promise<RatingsData> => {
    try {
      const response = await fetch('/api/ratings');
      if (!response.ok) {
        throw new Error('Failed to load ratings');
      }
      return (await response.json()) as RatingsData;
    } catch (error) {
      console.error('Error loading ratings:', error);
      return { personal: [], global: [], comparisonSets: [] };
    }
  };

  const updateStoredRatings = async (
    directoryPath: string,
    newRating: number,
    comparisonsCount: number,
    otherUpdates?: Array<{
      directoryPath: string;
      newRating: number;
      comparisonsCount: number;
    }>,
    comparisonSetId?: string,
    product?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directoryPath,
          rating: newRating,
          comparisons: comparisonsCount,
          comparisonSetId,
          product,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update ratings');
      }

      if (otherUpdates) {
        await Promise.all(
          otherUpdates.map((update) =>
            fetch('/api/ratings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                directoryPath: update.directoryPath,
                rating: update.newRating,
                comparisons: update.comparisonsCount,
                comparisonSetId,
                product,
              }),
            })
          )
        );
      }

      return true;
    } catch (error) {
      console.error('Error updating ratings:', error);
      return false;
    }
  };

  return {
    loadStoredRatings,
    updateStoredRatings,
  };
};
