export interface ImageFile {
  name: string;
  url?: string;
  product?: string;
  version?: string;
  file?: File;
}

export interface DirectoryState {
  v1: ImageFile[];
  v2: ImageFile[];
}

export interface ComparisonPair {
  left: {
    version: string;
    url: string;
    file: ImageFile;
    product?: string;
    referenceUrl?: string;  // URL of the reference image if this is a mask
    isMask?: boolean;       // Whether this is a mask image
  };
  right: {
    version: string;
    url: string;
    file: ImageFile;
    product?: string;
    referenceUrl?: string;  // URL of the reference image if this is a mask
    isMask?: boolean;       // Whether this is a mask image
  };
}

export interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

export type ComparisonResult = {
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  timestamp: string;
  winnerFile: string;
  loserFile: string;
  isTie?: boolean;
}; 