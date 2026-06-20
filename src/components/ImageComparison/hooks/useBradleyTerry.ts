import { useState, useCallback } from 'react';
import { INITIAL_RATING, applyWin, applyTie } from '@/lib/rating';

interface Rating {
  strength: number;
  wins: number;
  losses: number;
  ties: number;
  totalComparisons: number;
}

interface RatingMap {
  [key: string]: Rating;
}

const freshRating = (strength: number): Rating => ({
  strength,
  wins: 0,
  losses: 0,
  ties: 0,
  totalComparisons: 0,
});

/**
 * Stateful React wrapper around the pure Bradley-Terry/Elo math in `@/lib/rating`.
 * Tracks per-entity strength plus win/loss/tie counts for the current session.
 */
export const useBradleyTerry = (initialRating: number = INITIAL_RATING) => {
  const [ratings, setRatings] = useState<RatingMap>({});

  const initializeRating = useCallback((id: string) => {
    setRatings(prev => (prev[id] ? prev : { ...prev, [id]: freshRating(initialRating) }));
  }, [initialRating]);

  const updateRatings = useCallback((winnerId: string, loserId: string) => {
    setRatings(prev => {
      const winner = prev[winnerId] ?? freshRating(initialRating);
      const loser = prev[loserId] ?? freshRating(initialRating);

      const { winner: newWinnerStrength, loser: newLoserStrength } = applyWin(
        winner.strength,
        loser.strength,
      );

      return {
        ...prev,
        [winnerId]: {
          ...winner,
          strength: newWinnerStrength,
          wins: winner.wins + 1,
          totalComparisons: winner.totalComparisons + 1,
        },
        [loserId]: {
          ...loser,
          strength: newLoserStrength,
          losses: loser.losses + 1,
          totalComparisons: loser.totalComparisons + 1,
        },
      };
    });
  }, [initialRating]);

  const updateRatingsWithTie = useCallback((id1: string, id2: string) => {
    setRatings(prev => {
      const player1 = prev[id1] ?? freshRating(initialRating);
      const player2 = prev[id2] ?? freshRating(initialRating);

      const { a: newStrength1, b: newStrength2 } = applyTie(
        player1.strength,
        player2.strength,
      );

      return {
        ...prev,
        [id1]: {
          ...player1,
          strength: newStrength1,
          ties: player1.ties + 1,
          totalComparisons: player1.totalComparisons + 1,
        },
        [id2]: {
          ...player2,
          strength: newStrength2,
          ties: player2.ties + 1,
          totalComparisons: player2.totalComparisons + 1,
        },
      };
    });
  }, [initialRating]);

  const getRating = useCallback((id: string) => {
    return ratings[id]?.strength || initialRating;
  }, [ratings, initialRating]);

  const getConfidenceInterval = useCallback((id: string) => {
    const rating = ratings[id];
    if (!rating || rating.totalComparisons === 0) return null;

    // Standard error from the win/loss spread
    const se = Math.sqrt(
      (rating.wins * rating.losses) / Math.pow(rating.totalComparisons, 3),
    );

    // 95% confidence interval
    return {
      lower: rating.strength - 1.96 * se,
      upper: rating.strength + 1.96 * se,
    };
  }, [ratings]);

  const setInitialRating = useCallback((id: string, rating: number) => {
    setRatings(prev => ({ ...prev, [id]: freshRating(rating) }));
  }, []);

  return {
    ratings,
    updateRatings,
    updateRatingsWithTie,
    getRating,
    getConfidenceInterval,
    initializeRating,
    setInitialRating,
  };
};
