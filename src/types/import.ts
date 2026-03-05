export interface ColumnMapping {
  [internalField: string]: string;
}

export interface ImportResult {
  snapshot: {
    id: string;
    name: string;
    bugCount: number;
  };
  errors: string[];
}
