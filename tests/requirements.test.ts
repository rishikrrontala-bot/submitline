import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRequirement, exportMarkdown, lovhackRequirements, parsePastedRules } from '../src/lib/requirements';
import type { CheckResult, Draft } from '../src/lib/types';

const draft: Draft = {
  projectName: '', description: '', technologies: '', buildNotes: '', reuseNotes: '',
  liveUrl: '', repoUrl: '', videoUrl: '', prototypeNotes: '', pastedRules: '', videoConsent: false,
};

test('pasted rules retain exact source lines, remove duplicates, and respect conditional language', () => {
  const rules = parsePastedRules(
    '- Submit a public 2 to 3 minute demo video\n- Submit a public 2 to 3 minute demo video\n' +
    '2. A GitHub repository is optional if available\n- Explain the target user and project impact',
  );
  assert.equal(rules.length, 3);
  assert.equal(rules[0].sourcePassage, 'Submit a public 2 to 3 minute demo video');
  assert.equal(rules[0].kind, 'video');
  assert.equal(rules[0].obligation, 'required');
  assert.equal(rules[1].kind, 'repo');
  assert.equal(rules[1].obligation, 'conditional');
  assert.equal(rules[2].kind, 'manual');
});

test('required empty fields block, while an omitted LovHack repo remains optional', () => {
  const name = lovhackRequirements.find((item) => item.id === 'project-name')!;
  const video = lovhackRequirements.find((item) => item.id === 'demo-video')!;
  const repo = lovhackRequirements.find((item) => item.id === 'repository')!;
  assert.equal(evaluateRequirement(name, draft, {}, false).status, 'blocked');
  assert.equal(evaluateRequirement(video, draft, {}, false).status, 'blocked');
  assert.equal(evaluateRequirement(repo, draft, {}, false).status, 'review');
});

test('text needs human confirmation and stale link evidence is never reused', () => {
  const description = lovhackRequirements.find((item) => item.id === 'project-description')!;
  const live = lovhackRequirements.find((item) => item.id === 'working-demo')!;
  const filled = { ...draft, description: 'A complete project description', liveUrl: 'https://new.example.com' };
  const stale: CheckResult = {
    kind: 'live', inputUrl: 'https://old.example.com', status: 'verified', label: 'Reachable',
    detail: 'HTTP 200', observation: 'HTTP 200', checkedAt: new Date().toISOString(),
  };
  assert.equal(evaluateRequirement(description, filled, {}, false).status, 'review');
  assert.equal(evaluateRequirement({ ...description, confirmed: true }, filled, {}, false).status, 'verified');
  assert.equal(evaluateRequirement(live, filled, { live: stale }, false).status, 'review');
});

test('export preserves rule source and observed status rather than a readiness score', () => {
  const markdown = exportMarkdown(draft, lovhackRequirements, {}, false);
  assert.match(markdown, /NEEDS HUMAN REVIEW.*Public repository/);
  assert.match(markdown, /BLOCKED.*Public 2–3 minute demo video/);
  assert.match(markdown, /source.*lovhack-season-3\.devpost\.com/);
  assert.doesNotMatch(markdown, /readiness score/i);
});
