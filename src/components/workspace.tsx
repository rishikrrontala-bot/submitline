'use client';

import { useEffect, useMemo, useState } from 'react';
import { evaluateRequirement, exportMarkdown, lovhackRequirements, parsePastedRules } from '@/lib/requirements';
import { formatTimestamp, observationLabel, videoJumpUrl, youtubeId } from '@/lib/video';
import type { CheckKind, CheckResult, Draft, EvidenceStatus, Requirement, VideoJob } from '@/lib/types';

const emptyDraft: Draft = {
  projectName: '', description: '', technologies: '', buildNotes: '', reuseNotes: '',
  liveUrl: '', repoUrl: '', videoUrl: '', prototypeNotes: '', pastedRules: '', videoConsent: false,
};

const sampleDraft: Draft = {
  projectName: 'Northstar — sample entry',
  description: 'Northstar is a fictional study planner for students who need a clearer next step. This sample entry exists only to demonstrate Submitline’s checks; it is not your submission.',
  technologies: 'Next.js, TypeScript, browser storage — sample text',
  buildNotes: 'Sample claim: interface and study flow built during LovHack Season 3. Replace this with your actual work.',
  reuseNotes: 'Sample declaration: no pre-existing code reused. Replace with your actual disclosure.',
  liveUrl: 'https://example.com/this-demo-is-intentionally-missing',
  repoUrl: 'https://github.com/vercel/next.js',
  videoUrl: 'https://www.youtube.com/watch?v=y-FgiJwzyMM',
  prototypeNotes: '',
  pastedRules: '',
  videoConsent: false,
};

const statusNames: Record<EvidenceStatus, string> = {
  verified: 'Verified',
  blocked: 'Blocked',
  review: 'Needs human review',
};
const rank: Record<EvidenceStatus, number> = { blocked: 0, review: 1, verified: 2 };
const linkKinds: CheckKind[] = ['live', 'repo', 'video'];

function Status({ value }: { value: EvidenceStatus }) {
  return <span className={'status status-' + value}>{statusNames[value]}</span>;
}

function evidenceFallback(kind: CheckKind, draft: Draft): string {
  if (kind === 'repo' && !draft.repoUrl.trim()) return 'Optional for LovHack. Add a repository link if you want its public visibility checked.';
  if (kind === 'live' && !draft.liveUrl.trim()) return 'No live link entered. LovHack asks for one whenever possible; explain an alternative if needed.';
  if (kind === 'video' && !draft.videoUrl.trim()) return 'A 2–3 minute video accessible without permission is required.';
  return 'Waiting for an unauthenticated server check.';
}

export default function Workspace() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [requirements, setRequirements] = useState<Requirement[]>(lovhackRequirements);
  const [checks, setChecks] = useState<Partial<Record<CheckKind, CheckResult>>>({});
  const [busy, setBusy] = useState<Partial<Record<CheckKind, boolean>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [runStarted, setRunStarted] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);
  const [videoAnalyzedUrl, setVideoAnalyzedUrl] = useState('');
  const [videoError, setVideoError] = useState('');
  const [playerStart, setPlayerStart] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('submitline-draft-v1');
      if (saved) {
        const parsed = JSON.parse(saved) as { draft?: Draft; requirements?: Requirement[]; sampleMode?: boolean };
        if (parsed.draft && typeof parsed.draft === 'object') setDraft({ ...emptyDraft, ...parsed.draft, videoConsent: false });
        if (Array.isArray(parsed.requirements) && parsed.requirements.length) setRequirements(parsed.requirements);
        setSampleMode(Boolean(parsed.sampleMode));
      }
    } catch { /* an unreadable browser draft should not stop the app */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem('submitline-draft-v1', JSON.stringify({ draft: { ...draft, videoConsent: false }, requirements, sampleMode })); }
    catch { /* private browsing may disable storage */ }
  }, [draft, requirements, sampleMode, hydrated]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'videoUrl') {
      setVideoJob(null);
      setVideoAnalyzedUrl('');
      setVideoError('');
      setPlayerStart(0);
    }
  }

  function updateRequirement(id: string, patch: Partial<Requirement>) {
    setRequirements((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function loadSample() {
    setDraft(sampleDraft);
    setRequirements(lovhackRequirements);
    setChecks({});
    setVideoJob(null);
    setVideoAnalyzedUrl('');
    setVideoError('');
    setPlayerStart(0);
    setSampleMode(true);
    setRunStarted(false);
  }

  function startBlankEntry() {
    setDraft(emptyDraft);
    setRequirements(lovhackRequirements);
    setChecks({});
    setVideoJob(null);
    setVideoAnalyzedUrl('');
    setVideoError('');
    setPlayerStart(0);
    setSampleMode(false);
    setRunStarted(false);
  }

  function usePastedRules() {
    const extracted = parsePastedRules(draft.pastedRules);
    if (extracted.length) {
      setRequirements(extracted);
      setChecks({});
    }
  }

  async function checkOne(kind: CheckKind, suppliedUrl?: string) {
    const url = (suppliedUrl ?? (kind === 'live' ? draft.liveUrl : kind === 'repo' ? draft.repoUrl : draft.videoUrl)).trim();
    if (!url) return;
    setBusy((current) => ({ ...current, [kind]: true }));
    try {
      const response = await fetch('/api/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, url }),
      });
      const payload = await response.json() as CheckResult | { error: string };
      if (!response.ok || 'error' in payload) throw new Error('error' in payload ? payload.error : 'The check did not complete.');
      setChecks((current) => ({ ...current, [kind]: payload }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The check did not complete.';
      setChecks((current) => ({ ...current, [kind]: {
        kind, inputUrl: url, checkedAt: new Date().toISOString(),
        status: 'review', label: 'Check could not complete', detail: message, observation: message,
      } }));
    } finally {
      setBusy((current) => ({ ...current, [kind]: false }));
    }
  }

  async function pollVideo(requestId: string, videoUrl: string) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      try {
        const response = await fetch('/api/video/job?requestId=' + encodeURIComponent(requestId), { cache: 'no-store' });
        const payload = await response.json() as VideoJob | { error: string };
        if (!response.ok || 'error' in payload && !('state' in payload)) throw new Error('error' in payload ? payload.error : 'Video job could not be read.');
        const job = payload as VideoJob;
        setVideoJob(job);
        if (job.state === 'done') {
          setVideoAnalyzedUrl(videoUrl);
          if (!job.observations.length) setVideoError('deAPI finished, but returned no timestamped visual observations. Review the video yourself.');
          return;
        }
        if (job.state === 'error') {
          setVideoError(job.error || 'deAPI could not analyze this video.');
          return;
        }
      } catch (error) {
        setVideoError(error instanceof Error ? error.message : 'The video job could not be checked.');
        return;
      }
    }
    setVideoError('deAPI is still processing. Use “Resume video check” to continue polling this job.');
  }

  async function startVideo(videoUrl: string) {
    setVideoError('');
    setVideoJob(null);
    try {
      const response = await fetch('/api/video/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, consent: draft.videoConsent }),
      });
      const payload = await response.json() as { requestId?: string; state?: string; error?: string };
      if (!response.ok || !payload.requestId) throw new Error(payload.error || 'Video analysis could not start.');
      setVideoJob({ requestId: payload.requestId, state: 'pending', observations: [] });
      await pollVideo(payload.requestId, videoUrl);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Video analysis could not start.');
    }
  }

  async function runAll() {
    if (runBusy) return;
    setRunBusy(true);
    setRunStarted(true);
    const targets: { kind: CheckKind; url: string }[] = [
      { kind: 'live', url: draft.liveUrl },
      { kind: 'repo', url: draft.repoUrl },
      { kind: 'video', url: draft.videoUrl },
    ];
    try {
      await Promise.all(targets.filter((target) => target.url.trim()).map((target) => checkOne(target.kind, target.url)));
      if (draft.videoUrl.trim() && draft.videoConsent) await startVideo(draft.videoUrl.trim());
      else if (draft.videoUrl.trim()) setVideoError('Video Description was skipped. Confirm deAPI processing to run it.');
    } finally { setRunBusy(false); }
  }

  function downloadChecklist() {
    const markdown = exportMarkdown(draft, requirements, checks, videoAnalyzedUrl === draft.videoUrl && Boolean(videoJob?.observations.length), videoAnalyzedUrl === draft.videoUrl ? videoJob?.duration : undefined);
    const href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'submitline-final-checklist.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1_000);
  }

  const evaluated = useMemo(() => requirements.map((requirement, index) => ({
    requirement, index,
    ...evaluateRequirement(requirement, draft, checks, videoAnalyzedUrl === draft.videoUrl && Boolean(videoJob?.observations.length), videoAnalyzedUrl === draft.videoUrl ? videoJob?.duration : undefined),
  })).sort((a, b) => rank[a.status] - rank[b.status] || a.index - b.index),
  [requirements, draft, checks, videoAnalyzedUrl, videoJob]);
  const counts = {
    blocked: evaluated.filter((item) => item.status === 'blocked').length,
    review: evaluated.filter((item) => item.status === 'review').length,
    verified: evaluated.filter((item) => item.status === 'verified').length,
  };
  const videoId = youtubeId(draft.videoUrl);
  const videoObservations = videoAnalyzedUrl === draft.videoUrl ? videoJob?.observations || [] : [];
  const evidence = linkKinds.map((kind) => ({
    kind,
    result: checks[kind]?.inputUrl === (kind === 'live' ? draft.liveUrl : kind === 'repo' ? draft.repoUrl : draft.videoUrl).trim() ? checks[kind] : undefined,
    requirement: requirements.find((item) => item.kind === kind),
  })).sort((a, b) => {
    const aRank = a.result ? rank[a.result.status] : 1;
    const bRank = b.result ? rank[b.result.status] : 1;
    return aRank - bRank;
  });

  return (
    <div className="site-shell">
      <div className="topline" aria-hidden="true" />
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Submitline home">submitline<span>.</span></a>
        <div className="header-right">
          <span className="header-note">A final look from the other side of the link</span>
          <a className="header-link" href="https://lovhack-season-3.devpost.com/#challenge-requirements" target="_blank" rel="noreferrer">The rules ↗</a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Submission preflight / LovHack Season 3</p>
          <div className="hero-grid">
            <h1 id="hero-title">Before they <br className="mobile-break" /><em>click.</em></h1>
            <div className="hero-side">
              <p className="tiny-label">The judge-view check</p>
              <p>Good work can disappear behind a private video or a broken link. See what a judge can reach before you submit.</p>
            </div>
          </div>
          <div className="hero-bottom">
            <div className="deadline"><span className="pulse" aria-hidden="true" /><span>LovHack closes Oct 04, 11:45 PM EDT<br /><span className="tiny-label">Aim to submit by 9:45 PM EDT</span></span></div>
            <a className="hero-cta" href="#entry">Check my submission <span className="arrow" aria-hidden="true">↗</span></a>
          </div>
        </section>

        <div className="artifact-strip" aria-label="Submission materials">
          <div className="artifact"><span className="tiny-label">01 / Required</span><strong>The story</strong><small>Project name, description, tools, build work</small></div>
          <div className="artifact"><span className="tiny-label">02 / When possible</span><strong>The live work</strong><small>A judge-accessible app or prototype</small></div>
          <div className="artifact"><span className="tiny-label">03 / Optional</span><strong>The source</strong><small>A public repository if you share one</small></div>
          <div className="artifact"><span className="tiny-label">04 / Required</span><strong>The video</strong><small>2–3 minutes, accessible without permission</small></div>
        </div>

        <section className="work-area" id="entry" aria-labelledby="work-title">
          <div className="section-heading">
            <div><span className="section-index">01 / The workspace</span><h2 id="work-title">Put it to the test.</h2></div>
            <p>One contract. Real requests. Each result tied to the rule that prompted it. No invented readiness score.</p>
          </div>

          <div className="work-grid">
            <form className="entry-panel" onSubmit={(event) => { event.preventDefault(); void runAll(); }}>
              <div className="panel-head"><h3>Your draft</h3><button type="button" className="text-action" onClick={loadSample}>Load example ↗</button></div>
              {sampleMode && <div className="sample-note"><p><strong>Example only.</strong> Northstar is fictional. The live URL is intentionally missing; the repository and video belong to public reference projects.</p><button type="button" className="text-action" onClick={startBlankEntry}>Start a blank entry ↗</button></div>}

              <div className="field">
                <label className="field-label" htmlFor="project-name">Project name <small>Devpost project name</small></label>
                <input id="project-name" value={draft.projectName} onChange={(event) => updateDraft('projectName', event.target.value)} placeholder="What should judges call it?" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="description">Project description <small>Official: Project Description</small></label>
                <textarea id="description" className="tall-textarea" value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} placeholder="Who is it for? What problem does it solve? What did you build?" />
                <p className="rule-ref"><a href="https://lovhack-season-3.devpost.com/#challenge-requirements" target="_blank" rel="noreferrer">Read the source rule ↗</a></p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="live-url">Live app or prototype <small>Whenever possible</small></label>
                <div className="input-row"><input id="live-url" type="url" value={draft.liveUrl} onChange={(event) => updateDraft('liveUrl', event.target.value)} placeholder="https://your-app.example" /><button type="button" className="rerun-button" disabled={!draft.liveUrl.trim() || busy.live} onClick={() => void checkOne('live')}>{busy.live ? 'Checking…' : 'Recheck ↗'}</button></div>
                <p className="rule-ref">Checked by an unauthenticated server request. A 200 response does not prove functionality.</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="repo-url">Public repository <small>Optional for LovHack</small></label>
                <div className="input-row"><input id="repo-url" type="url" value={draft.repoUrl} onChange={(event) => updateDraft('repoUrl', event.target.value)} placeholder="https://github.com/you/project" /><button type="button" className="rerun-button" disabled={!draft.repoUrl.trim() || busy.repo} onClick={() => void checkOne('repo')}>{busy.repo ? 'Checking…' : 'Recheck ↗'}</button></div>
                <p className="rule-ref">GitHub public visibility is checked through its unauthenticated API.</p>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="video-url">Public demo video <small>Required · 2–3 minutes</small></label>
                <div className="input-row"><input id="video-url" type="url" value={draft.videoUrl} onChange={(event) => updateDraft('videoUrl', event.target.value)} placeholder="https://www.youtube.com/watch?v=…" /><button type="button" className="rerun-button" disabled={!draft.videoUrl.trim() || busy.video} onClick={() => void checkOne('video')}>{busy.video ? 'Checking…' : 'Recheck ↗'}</button></div>
                <p className="rule-ref">YouTube, X, Twitch, Kick, or TikTok can be sent to deAPI for visual observations.</p>
              </div>
              <label className="consent-line"><input type="checkbox" checked={draft.videoConsent} onChange={(event) => updateDraft('videoConsent', event.target.checked)} /><span>Analyze my public video with deAPI. Its Video Description service processes the URL and video pixels; it does not verify audio or functionality.</span></label>

              <div className="input-block">
                <h4>The remaining submission text</h4>
                <div className="field">
                  <label className="field-label" htmlFor="technologies">Technologies used <small>Required submission item</small></label>
                  <textarea id="technologies" value={draft.technologies} onChange={(event) => updateDraft('technologies', event.target.value)} placeholder="Frameworks, APIs, models, platforms…" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="build-notes">Built during LovHack <small>Sep 26 – Oct 04</small></label>
                  <textarea id="build-notes" value={draft.buildNotes} onChange={(event) => updateDraft('buildNotes', event.target.value)} placeholder="What is new in this build period?" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="reuse-notes">Earlier work disclosure <small>Say “none” if none</small></label>
                  <textarea id="reuse-notes" value={draft.reuseNotes} onChange={(event) => updateDraft('reuseNotes', event.target.value)} placeholder="What code, design, or templates existed beforehand?" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="prototype-notes">If the prototype cannot be public <small>Conditional</small></label>
                  <textarea id="prototype-notes" value={draft.prototypeNotes} onChange={(event) => updateDraft('prototypeNotes', event.target.value)} placeholder="How can judges evaluate it?" />
                </div>
              </div>

              <div className="run-row">
                <button className="primary-button" type="submit" disabled={runBusy}>{runBusy ? 'Checking submission…' : 'Run judge-view preflight'} <span className="arrow" aria-hidden="true">↗</span></button>
                <span className="tiny-label">Each check reports separately as it completes.</span>
              </div>

              <details className="rules-details">
                <summary>Checking another event? Paste its rules</summary>
                <div className="field">
                  <label className="field-label" htmlFor="pasted-rules">Submission requirements <small>Exact source lines stay visible</small></label>
                  <textarea id="pasted-rules" className="tall-textarea" value={draft.pastedRules} onChange={(event) => updateDraft('pastedRules', event.target.value)} placeholder="Paste the event’s submission requirements, one item per line." />
                </div>
                <div className="rules-actions">
                  <button type="button" className="text-action" onClick={usePastedRules}>Extract checklist ↗</button>
                  <button type="button" className="text-action" onClick={() => setRequirements(lovhackRequirements)}>Use LovHack rules ↗</button>
                </div>
              </details>
            </form>

            <div className="results-panel" aria-live="polite">
              <div className="panel-head"><h3>Judge view</h3><span className="tiny-label">Evidence / not a score</span></div>
              <p className="result-intro">{runStarted ? <>A clear view of <em>what holds up.</em></> : <>Nothing assumed. <em>Everything observed.</em></>}</p>
              <div className="result-counts" aria-label="Requirement statuses">
                <span className="status-blocked"><b>{counts.blocked}</b> blockers</span>
                <span className="status-review"><b>{counts.review}</b> human review</span>
                <span className="status-verified"><b>{counts.verified}</b> verified</span>
              </div>

              <div className="board-title"><h4>Requirements</h4><span className="tiny-label">Source beside status</span></div>
              <div className="requirement-list">
                {evaluated.map(({ requirement, index, status, reason }) => (
                  <article className="requirement" key={requirement.id}>
                    <div className="requirement-top">
                      <span className="requirement-number">{String(index + 1).padStart(2, '0')}</span>
                      <div><h5>{requirement.title}</h5><p className="summary">{requirement.summary}</p></div>
                      <Status value={status} />
                    </div>
                    <p className="reason">{reason}</p>
                    <div className="source-row"><span className="source-label">Rule /</span><span>{requirement.sourcePassage}</span>{requirement.sourceUrl && <a href={requirement.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}<span className="obligation">{requirement.obligation}</span></div>
                    <details className="rule-editor"><summary>Correct extracted item</summary>
                      <div className="rule-edit">
                        <label><span className="sr-only">Requirement title</span><input value={requirement.title} onChange={(event) => updateRequirement(requirement.id, { title: event.target.value })} /></label>
                        <label><span className="sr-only">Evidence field</span><select value={requirement.kind} onChange={(event) => updateRequirement(requirement.id, { kind: event.target.value as Requirement['kind'], confirmed: false })}><option value="name">Project name</option><option value="description">Description</option><option value="live">Live demo</option><option value="repo">Repository</option><option value="video">Video</option><option value="technologies">Technologies</option><option value="build">Build-period work</option><option value="reuse">Earlier work</option><option value="manual">Manual review</option></select></label>
                        <label><span className="sr-only">Requirement obligation</span><select value={requirement.obligation} onChange={(event) => updateRequirement(requirement.id, { obligation: event.target.value as Requirement['obligation'] })}><option value="required">Required</option><option value="conditional">Conditional</option><option value="optional">Optional</option></select></label>
                      </div>
                    </details>
                    {(status === 'review' || requirement.confirmed) && <label className="confirm-line"><input type="checkbox" checked={requirement.confirmed} onChange={(event) => updateRequirement(requirement.id, { confirmed: event.target.checked })} /><span>I reviewed this item against its source and confirmed the submitted material.</span></label>}
                  </article>
                ))}
              </div>

              <div className="board-title"><h4>Observed from outside</h4><span className="tiny-label">Unauthenticated requests</span></div>
              <div className="evidence-list">
                {evidence.map(({ kind, result, requirement }) => (
                  <article className="evidence-row" key={kind}>
                    <span className="kicker">{kind === 'live' ? '01 / LIVE' : kind === 'repo' ? '02 / SOURCE' : '03 / VIDEO'}</span>
                    <div>
                      {busy[kind] ? <span className="status status-review">Checking now</span> : result ? <Status value={result.status} /> : <span className="status status-review">Not checked</span>}
                      <strong>{busy[kind] ? 'Request in progress…' : result?.label || (kind === 'live' ? 'Live app' : kind === 'repo' ? 'Repository' : 'Demo video')}</strong>
                      <p>{result?.detail || evidenceFallback(kind, draft)}</p>
                      <div className="evidence-meta">
                        {requirement?.sourceUrl ? <a href={requirement.sourceUrl} target="_blank" rel="noreferrer">Rule: {requirement.sourcePassage} ↗</a> : <span />}
                        {result && <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="board-title"><h4>Inside the video</h4><span className="tiny-label">deAPI / visual only</span></div>
              <p className="video-note">deAPI processes the submitted video and describes visible scenes. Its observations are reviewable evidence, not proof that the product works. Confirm logged-out playback yourself.</p>
              {videoJob && <p className="video-state">Video job / {videoJob.state}{videoJob.duration ? ' · ' + formatTimestamp(videoJob.duration) : ''}</p>}
              {videoError && <p className="notice" role="status">{videoError}</p>}
              {videoJob && ['pending', 'processing'].includes(videoJob.state) && videoError && <button type="button" className="text-action" onClick={() => { setVideoError(''); void pollVideo(videoJob.requestId, draft.videoUrl); }}>Resume video check ↗</button>}
              {runStarted && videoId && <iframe key={videoId + '-' + playerStart} className="video-player" src={'https://www.youtube-nocookie.com/embed/' + videoId + '?start=' + Math.floor(playerStart) + '&rel=0'} title="Demo video player" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
              {videoObservations.length > 0 && <ol className="timeline" aria-label="Timestamped video observations">
                {videoObservations.map((observation, index) => {
                  const jump = videoJumpUrl(draft.videoUrl, observation.start);
                  return <li key={index}>
                    {videoId || jump
                      ? <button type="button" onClick={() => { if (videoId) setPlayerStart(observation.start); else if (jump) window.open(jump, '_blank', 'noopener,noreferrer'); }} aria-label={'Jump to ' + formatTimestamp(observation.start)}>{formatTimestamp(observation.start)} ↗</button>
                      : <span className="timeline-time" title="Open the original video and seek to this time manually">{formatTimestamp(observation.start)}</span>}
                    <div><p>{observation.description}</p><small>{observationLabel(observation)} · model output</small>{jump && <a href={jump} target="_blank" rel="noreferrer" className="mini-action">Open at this moment ↗</a>}</div>
                  </li>;
                })}
              </ol>}
              {!videoObservations.length && !videoJob && <p className="rule-ref">No model observations yet. A real run requires a deAPI key and your consent above.</p>}

              <div className="finish-row">
                <p>Export records each rule, observed result, and remaining manual check. Recheck all links while logged out before submitting to Devpost.</p>
                <button className="export-button" type="button" onClick={downloadChecklist}>Export final checklist ↓</button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><strong>Built by Rishik Rontala</strong><span>Submitline · LovHack Season 3 · <a href="https://lovhack-season-3.devpost.com/rules" target="_blank" rel="noreferrer">Official rules ↗</a></span></footer>
    </div>
  );
}
