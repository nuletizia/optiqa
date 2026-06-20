import { Card, CardContent } from "@/components/ui/card";

interface RatingsHistogramProps {
  directoryNames: { v1: string; v2: string };
  comparisons: Array<{
    winner: string;
    loser: string;
    winnerScore: number;
    loserScore: number;
    timestamp: string;
  }>;
}

export const RatingsHistogram = ({ directoryNames, comparisons }: RatingsHistogramProps) => {
  // Calculate histogram data for both directories
  const v1Scores = comparisons
    .map(comp => comp.winner === directoryNames.v1 ? comp.winnerScore : comp.loserScore)
    .sort((a, b) => a - b);
  
  const v2Scores = comparisons
    .map(comp => comp.winner === directoryNames.v2 ? comp.winnerScore : comp.loserScore)
    .sort((a, b) => a - b);

  // Calculate statistics
  const getStats = (scores: number[]) => ({
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    median: scores[Math.floor(scores.length / 2)]
  });

  const v1Stats = getStats(v1Scores);
  const v2Stats = getStats(v2Scores);

  // Calculate histogram bars (10 bins)
  const getBins = (scores: number[], min: number, max: number) => {
    const bins = Array(10).fill(0);
    const binSize = (max - min) / 10;
    
    scores.forEach(score => {
      const binIndex = Math.min(Math.floor((score - min) / binSize), 9);
      bins[binIndex]++;
    });

    return bins;
  };

  const v1Bins = getBins(v1Scores, Math.min(v1Stats.min, v2Stats.min), Math.max(v1Stats.max, v2Stats.max));
  const v2Bins = getBins(v2Scores, Math.min(v1Stats.min, v2Stats.min), Math.max(v1Stats.max, v2Stats.max));
  const maxBinHeight = Math.max(...v1Bins, ...v2Bins);

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-8">
            {/* V1 Stats */}
            <div>
              <h3 className="font-medium mb-2">{directoryNames.v1} Statistics</h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Average: {v1Stats.avg.toFixed(2)}</p>
                <p>Median: {v1Stats.median.toFixed(2)}</p>
                <p>Range: {v1Stats.min.toFixed(2)} - {v1Stats.max.toFixed(2)}</p>
              </div>
            </div>
            
            {/* V2 Stats */}
            <div>
              <h3 className="font-medium mb-2">{directoryNames.v2} Statistics</h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Average: {v2Stats.avg.toFixed(2)}</p>
                <p>Median: {v2Stats.median.toFixed(2)}</p>
                <p>Range: {v2Stats.min.toFixed(2)} - {v2Stats.max.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Histogram */}
          <div className="relative h-40 mt-4">
            {/* V1 Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {v1Bins.map((count, i) => (
                <div
                  key={`v1-${i}`}
                  className="w-full bg-blue-500/30 transition-all"
                  style={{
                    height: `${(count / maxBinHeight) * 100}%`
                  }}
                />
              ))}
            </div>
            
            {/* V2 Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-1">
              {v2Bins.map((count, i) => (
                <div
                  key={`v2-${i}`}
                  className="w-full bg-green-500/30 transition-all"
                  style={{
                    height: `${(count / maxBinHeight) * 100}%`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500/30" />
              <span>{directoryNames.v1}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/30" />
              <span>{directoryNames.v2}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 