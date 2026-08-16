export interface PineParam {
  name: string;
  type?: string;
  description: string;
  optional?: boolean;
}

export interface PineRefEntry {
  kind: string;
  summary: string;
  path: string;
  description?: string;
  syntax?: string[];
  params?: PineParam[];
  returns?: string;
  example?: string;
  remarks?: string;
}
