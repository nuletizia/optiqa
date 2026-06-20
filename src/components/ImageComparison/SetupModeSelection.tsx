import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudIcon, FolderIcon } from "lucide-react";

interface SetupModeSelectionProps {
  onModeSelect: (mode: 'preset' | 'local') => void;
}

export const SetupModeSelection = ({ onModeSelect }: SetupModeSelectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onModeSelect('preset')}>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <CloudIcon className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Use Preset Directories</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Compare pre-configured image sets from our cloud storage
          </p>
          <Button variant="outline">
            Select Presets
          </Button>
        </CardContent>
      </Card>

      <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onModeSelect('local')}>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <FolderIcon className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Use Local Directories</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Compare images from directories on your computer
          </p>
          <Button variant="outline">
            Select Local Directories
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}; 