export type EvidenceStatus = 'verified' | 'blocked' | 'review';
export type CheckKind = 'live' | 'repo' | 'video';
export type RequirementKind = CheckKind | 'name' | 'description' | 'technologies' | 'build' | 'reuse' | 'manual';
export type Obligation = 'required' | 'conditional' | 'optional';

export interface Requirement {
  id: string;
  title: string;
  summary: string;
  sourcePassage: string;
  sourceUrl: string;
  source: 'lovhack' | 'pasted';
  kind: RequirementKind;
  obligation: Obligation;
  confirmed: boolean;
}

export interface CheckResult {
  kind: CheckKind;
  status: EvidenceStatus;
  label: string;
  detail: string;
  observation: string;
  checkedAt: string;
  inputUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  title?: string;
  durationSeconds?: number;
  durationSource?: 'youtube-data-api';
}

export interface VideoObservation {
  start: number;
  end?: number;
  description: string;
  source: 'deapi';
}

export interface VideoJob {
  requestId: string;
  state: 'pending' | 'processing' | 'done' | 'error';
  observations: VideoObservation[];
  duration?: number;
  error?: string;
}

export interface Draft {
  projectName: string;
  description: string;
  technologies: string;
  buildNotes: string;
  reuseNotes: string;
  liveUrl: string;
  repoUrl: string;
  videoUrl: string;
  prototypeNotes: string;
  pastedRules: string;
  videoConsent: boolean;
}
