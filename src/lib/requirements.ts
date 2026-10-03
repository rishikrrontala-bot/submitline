import type { CheckResult, Draft, EvidenceStatus, Requirement, RequirementKind } from './types';

const sourceUrl = 'https://lovhack-season-3.devpost.com/#challenge-requirements';

// Short official section names identify the passage; the linked source remains authoritative.
export const lovhackRequirements: Requirement[] = [
  {
    id: 'project-name', title: 'Project name', kind: 'name', obligation: 'required',
    summary: 'Give judges a clear project name in the Devpost entry.',
    sourcePassage: 'Project Name', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'project-description', title: 'Project description', kind: 'description', obligation: 'required',
    summary: 'Explain the problem, audience, solution, differentiation, and what was built during this event.',
    sourcePassage: 'Project Description', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'demo-video', title: 'Public 2–3 minute demo video', kind: 'video', obligation: 'required',
    summary: 'The demo must be accessible to judges without requesting permission.',
    sourcePassage: 'Demo Video', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'working-demo', title: 'Working demo or prototype', kind: 'live', obligation: 'conditional',
    summary: 'Provide a working link whenever possible; otherwise explain how judges can evaluate the project.',
    sourcePassage: 'Working Demo or Prototype', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'technology-list', title: 'Technologies used', kind: 'technologies', obligation: 'required',
    summary: 'List major tools, frameworks, APIs, models, platforms, and sponsor technology.',
    sourcePassage: 'Technologies Used', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'build-period', title: 'Work built during Season 3', kind: 'build', obligation: 'required',
    summary: 'State what was built from September 26 to October 4, 2026.',
    sourcePassage: 'What You Built During the Hackathon', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'reuse-disclosure', title: 'Earlier work disclosure', kind: 'reuse', obligation: 'required',
    summary: 'Disclose reused code, designs, or templates, or explicitly state that none were reused.',
    sourcePassage: 'What You Built During the Hackathon', sourceUrl, source: 'lovhack', confirmed: false,
  },
  {
    id: 'repository', title: 'Public repository', kind: 'repo', obligation: 'optional',
    summary: 'A repository is one example of a shareable prototype, not a standalone LovHack requirement.',
    sourcePassage: 'GitHub repository', sourceUrl, source: 'lovhack', confirmed: false,
  },
];

const keywordKind = (line: string): RequirementKind => {
  const value = line.toLowerCase();
  if (/video|youtube|vimeo/.test(value)) return 'video';
  if (/repo|github|gitlab|source code/.test(value)) return 'repo';
  if (/live|prototype|deployed|demo link|website|web app/.test(value)) return 'live';
  if (/technolog|framework|api|tool/.test(value)) return 'technologies';
  if (/prior work|pre.?existing|reus/.test(value)) return 'reuse';
  if (/built during|work created during|new work/.test(value)) return 'build';
  if (/description|write.?up|explain the project/.test(value)) return 'description';
  if (/project name|title of project/.test(value)) return 'name';
  return 'manual';
};

export function parsePastedRules(raw: string): Requirement[] {
  const candidates = raw.slice(0, 12_000).split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length >= 12 && line.length <= 600);
  const unique = [...new Set(candidates.map((line) => line.replace(/\s+/g, ' ')))].slice(0, 20);
  return unique.map((line, index) => ({
    id: 'pasted-' + index,
    title: line.length > 78 ? line.slice(0, 75).trimEnd() + '…' : line,
    summary: line, sourcePassage: line, sourceUrl: '', source: 'pasted' as const,
    kind: keywordKind(line),
    obligation: /\b(optional|may|whenever possible|if available|recommended|not required)\b/i.test(line) ? 'conditional' as const : 'required' as const,
    confirmed: false,
  }));
}

function inputFor(kind: RequirementKind, draft: Draft): string {
  switch (kind) {
    case 'name': return draft.projectName;
    case 'description': return draft.description;
    case 'technologies': return draft.technologies;
    case 'build': return draft.buildNotes;
    case 'reuse': return draft.reuseNotes;
    case 'live': return draft.liveUrl;
    case 'repo': return draft.repoUrl;
    case 'video': return draft.videoUrl;
    default: return '';
  }
}

export function evaluateRequirement(
  requirement: Requirement,
  draft: Draft,
  checks: Partial<Record<'live' | 'repo' | 'video', CheckResult>>,
  videoAnalyzed: boolean,
  videoDuration?: number,
): { status: EvidenceStatus; reason: string } {
  if (requirement.kind === 'manual') return requirement.confirmed
    ? { status: 'verified', reason: 'Confirmed by entrant against the pasted rule.' }
    : { status: 'review', reason: 'Read the source rule and confirm this item manually.' };
  const input = inputFor(requirement.kind, draft).trim();
  if (!input) {
    if (requirement.kind === 'live' && draft.prototypeNotes.trim()) return { status: 'review', reason: 'Alternative judge-evaluation plan supplied; review it manually.' };
    if (requirement.obligation === 'optional') return { status: 'review', reason: requirement.kind === 'repo' ? 'Optional for LovHack; no repository supplied.' : 'Optional item not supplied.' };
    return { status: requirement.obligation === 'required' ? 'blocked' : 'review', reason: 'No matching submission item entered.' };
  }
  if (requirement.kind === 'live' || requirement.kind === 'repo' || requirement.kind === 'video') {
    const result = checks[requirement.kind];
    if (!result || result.inputUrl !== input) return { status: 'review', reason: 'Ready to check from an unauthenticated server request.' };
    if (result.status === 'blocked') return { status: 'blocked', reason: result.detail };
    if (requirement.kind === 'video' && videoDuration !== undefined && (videoDuration < 120 || videoDuration > 180)) {
      return { status: 'blocked', reason: 'deAPI reports a video duration of ' + Math.round(videoDuration) + ' seconds; LovHack asks for 2–3 minutes. Confirm the original duration.' };
    }
    if (requirement.kind === 'video' && requirement.confirmed && result.status === 'review') return {
      status: 'verified', reason: 'The video page responded, and the entrant confirmed logged-out playback and content.',
    };
    if (result.status === 'review') return { status: 'review', reason: result.detail };
    if (requirement.kind === 'video' && !requirement.confirmed) return {
      status: 'review',
      reason: videoAnalyzed ? 'Visual observations are ready; confirm logged-out playback and content.' : 'The page responded; confirm logged-out playback and content.',
    };
    return { status: 'verified', reason: requirement.kind === 'video' ? 'Server evidence and entrant playback review are complete.' : result.detail };
  }
  return requirement.confirmed
    ? { status: 'verified', reason: 'Entrant confirmed this text against the source rule.' }
    : { status: 'review', reason: 'Text is present; confirm its substance against the source rule.' };
}

export function exportMarkdown(
  draft: Draft,
  requirements: Requirement[],
  checks: Partial<Record<'live' | 'repo' | 'video', CheckResult>>,
  videoAnalyzed: boolean,
  videoDuration?: number,
): string {
  const lines = [
    '# ' + (draft.projectName.trim() || 'Untitled project') + ' — final submission check',
    '', 'Exported: ' + new Date().toISOString(), '',
    '## Project description', '', draft.description.trim() || '_Not entered._', '',
    '## Submission links', '',
    '- Live demo: ' + (draft.liveUrl.trim() || '_Not supplied_'),
    '- Repository: ' + (draft.repoUrl.trim() || '_Not supplied (optional for LovHack)_'),
    '- Video: ' + (draft.videoUrl.trim() || '_Not supplied_'),
    '', '## Technologies used', '', draft.technologies.trim() || '_Not entered._',
    '', '## Built during the hackathon', '', draft.buildNotes.trim() || '_Not entered._',
    '', '## Earlier work disclosure', '', draft.reuseNotes.trim() || '_Not entered._',
    '', '## Requirement checklist', '',
  ];
  for (const requirement of requirements) {
    const evaluation = evaluateRequirement(requirement, draft, checks, videoAnalyzed, videoDuration);
    const source = requirement.sourceUrl ? ' ([source](' + requirement.sourceUrl + '))' : ' (pasted rule)';
    lines.push('- **' + (evaluation.status === 'review' ? 'NEEDS HUMAN REVIEW' : evaluation.status.toUpperCase()) + '** — ' + requirement.title + ' [' + requirement.obligation + ']' + source);
    lines.push('  - Rule: ' + requirement.sourcePassage);
    lines.push('  - Evidence: ' + evaluation.reason);
  }
  lines.push('', 'This export records observations at a point in time. Recheck links while logged out before Devpost submission.', '');
  return lines.join('\n');
}
