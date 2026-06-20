import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Settings } from "lucide-react";
import { SetupModeSelection } from './SetupModeSelection';
import type { DirectoryState, ImageFile } from './types';
import { PresetDirectorySetup } from './PresetDirectorySetup';
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DirectorySetupProps {
  imageFiles: DirectoryState;
  directoryNames: { v1: string; v2: string };
  useMatchedPairs: boolean;
  useScoreBlur: boolean;
  onDirectorySetup: (version: 'v1' | 'v2', files: ImageFile[], directoryPath?: string) => Promise<void>;
  onNameUpdate: (version: 'v1' | 'v2', name: string) => void;
  onModeChange: (useMatched: boolean) => void;
  onScoreBlurChange: (useBlur: boolean) => void;
  onStart: () => void;
  isReadyToStart: boolean;
  setupMode: 'preset' | 'local' | null;
  onSetupModeChange: (mode: 'preset' | 'local' | null) => void;
  usePersistentRatings: boolean;
  onPersistentRatingsChange: (value: boolean) => void;
  selectedDirectories: { v1: string | null; v2: string | null };
  onDirectoriesSelected: (directories: string[]) => void;
  onComparisonSetSelect?: (setId: string | null) => void;
}

export const DirectorySetup = ({
  imageFiles,
  directoryNames,
  useMatchedPairs,
  useScoreBlur,
  onDirectorySetup,
  onNameUpdate,
  onModeChange,
  onScoreBlurChange,
  onStart,
  isReadyToStart,
  setupMode,
  onSetupModeChange,
  usePersistentRatings,
  onPersistentRatingsChange,
  selectedDirectories,
  onDirectoriesSelected,
  onComparisonSetSelect
}: DirectorySetupProps) => {
  if (!setupMode) {
    return <SetupModeSelection onModeSelect={onSetupModeChange} />;
  }

  if (setupMode === 'preset') {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuLabel>Comparison Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-2 cursor-default">
                <div className="flex items-center justify-between space-x-2 w-full">
                  <Label htmlFor="score-blur" className="cursor-pointer">Hide Scores</Label>
                  <Switch
                    id="score-blur"
                    checked={useScoreBlur}
                    onCheckedChange={onScoreBlurChange}
                  />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-2 cursor-default">
                <div className="flex items-center justify-between space-x-2 w-full">
                  <Label htmlFor="comparison-mode" className="cursor-pointer">Match Images</Label>
                  <Switch
                    id="comparison-mode"
                    checked={useMatchedPairs}
                    onCheckedChange={onModeChange}
                  />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-2 cursor-default">
                <div className="flex items-center justify-between space-x-2 w-full">
                  <Label htmlFor="persistent-ratings" className="cursor-pointer">Update Ratings</Label>
                  <Switch
                    id="persistent-ratings"
                    checked={usePersistentRatings}
                    onCheckedChange={onPersistentRatingsChange}
                  />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <PresetDirectorySetup
          imageFiles={imageFiles}
          directoryNames={directoryNames}
          onDirectorySelect={onDirectorySetup}
          onNameUpdate={onNameUpdate}
          onStart={onStart}
          isReadyToStart={isReadyToStart}
          onComparisonSetSelect={onComparisonSetSelect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {/* Score Blur Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <Switch
              id="score-blur"
              checked={useScoreBlur}
              onCheckedChange={onScoreBlurChange}
            />
            <Label htmlFor="score-blur" className="flex flex-col gap-1">
              <span>Hide Scores</span>
              <span className="text-sm text-muted-foreground">
                Only show scores every 10 comparisons to prevent bias
              </span>
            </Label>
          </div>
        </div>

        {/* Comparison Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <Switch
              id="comparison-mode"
              checked={useMatchedPairs}
              onCheckedChange={onModeChange}
            />
            <Label htmlFor="comparison-mode" className="flex flex-col gap-1">
              <span>Match Images</span>
              <span className="text-sm text-muted-foreground">
                {useMatchedPairs ? 
                  "Compare images with matching filenames" : 
                  "Compare random pairs of images"
                }
              </span>
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* First Directory Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Directory 1</CardTitle>
                <input
                  type="text"
                  value={directoryNames.v1}
                  onChange={(e) => onNameUpdate('v1', e.target.value)}
                  className="px-2 py-1 text-sm border rounded-md w-24"
                  placeholder="Name"
                />
              </div>
              {imageFiles.v1.length > 0 && (
                <Badge variant="secondary">
                  {imageFiles.v1.length} images
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => onDirectorySetup('v1', imageFiles.v1)}
              className="w-full"
              variant="outline"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Directory
            </Button>
          </CardContent>
        </Card>

        {/* Second Directory Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Directory 2</CardTitle>
                <input
                  type="text"
                  value={directoryNames.v2}
                  onChange={(e) => onNameUpdate('v2', e.target.value)}
                  className="px-2 py-1 text-sm border rounded-md w-24"
                  placeholder="Name"
                />
              </div>
              {imageFiles.v2.length > 0 && (
                <Badge variant="secondary">
                  {imageFiles.v2.length} images
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => onDirectorySetup('v2', imageFiles.v2)}
              className="w-full"
              variant="outline"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Directory
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add Start Button Section */}
      {imageFiles.v1.length > 0 && imageFiles.v2.length > 0 && (
        <div className="flex justify-end space-x-2">
          <Button 
            onClick={onStart}
            disabled={!isReadyToStart}
          >
            Start Comparison
          </Button>
        </div>
      )}
    </div>
  );
}; 