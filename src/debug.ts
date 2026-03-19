// LLM Debug Console — frontend logic

const API = '/api/debug';

interface CallMeta {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  elapsedMs: number;
}

interface DebugConfig {
  llmEnabled: boolean;
  model: string;
  modelFast: string;
  baseURL: string;
  aiPatterns: Record<string, unknown>;
  storyArc: { questsPerArc: number; bossQuestEnabled: boolean };
  npcIds: string[];
}

interface SessionState {
  hasArc: boolean;
  arcTitle: string | null;
  hasLore: boolean;
  questCount: number;
  evaluationCount: number;
}

// ── State ──

let cfg: DebugConfig | null = null;
let arcQuestCount = 0;
let questGenerated: boolean[] = [];
let inflight = false;

// ── DOM refs ──

const $output = document.getElementById('output')!;
const $configGrid = document.getElementById('config-grid')!;
const $questBtns = document.getElementById('quest-buttons')!;
const $evalBtns = document.getElementById('eval-buttons')!;
const $npcSelect = document.getElementById('npc-select') as HTMLSelectElement;
const $btnArc = document.getElementById('btn-arc') as HTMLButtonElement;
const $btnLore = document.getElementById('btn-lore') as HTMLButtonElement;
const $btnStandalone = document.getElementById('btn-standalone') as HTMLButtonElement;
const $btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

// ── Helpers ──

function setLoading(btn: HTMLButtonElement, loading: boolean) {
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  if (loading) {
    btn.dataset.origText = btn.textContent ?? '';
    btn.textContent = btn.dataset.origText + '...';
  } else {
    btn.textContent = btn.dataset.origText ?? btn.textContent ?? '';
  }
}

function scoreClass(n: number): string {
  if (n >= 7) return 'high';
  if (n >= 5) return 'mid';
  return 'low';
}

interface DialogNode {
  id: string;
  speaker: string;
  text: string;
  responses?: { text: string; nextNodeId: string; action?: { type: string } }[];
}

type QuestDialog = { offer: DialogNode[]; inProgress: DialogNode[]; readyToTurnIn: DialogNode[]; completed: DialogNode[] };

function formatDialog(dialog: QuestDialog): string {
  const phases = ['offer', 'inProgress', 'readyToTurnIn', 'completed'] as const;
  const phaseLabels: Record<string, string> = {
    offer: 'Offer', inProgress: 'In Progress', readyToTurnIn: 'Ready to Turn In', completed: 'Completed'
  };

  return phases.map(phase => {
    const nodes = dialog[phase];
    if (!nodes?.length) return '';

    const lines = nodes.map(node => {
      let s = `  <span class="dialog-speaker">${escHtml(node.speaker)}:</span> ${escHtml(node.text)}`;
      if (node.responses?.length) {
        s += '\n' + node.responses.map(r => {
          const action = r.action ? ` <span class="dialog-action">[${r.action.type}]</span>` : '';
          return `    → "${escHtml(r.text)}"${action}`;
        }).join('\n');
      }
      return s;
    }).join('\n');

    return `<div class="dialog-phase"><span class="dialog-phase-label">${phaseLabels[phase]}</span>\n${lines}</div>`;
  }).filter(Boolean).join('\n');
}

function addLogEntry(title: string, meta: CallMeta | null, bodyHtml: string, isError = false) {
  // Clear empty state
  const empty = $output.querySelector('.empty-state');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry open${isError ? ' log-error' : ''}`;

  const timeStr = meta ? `${(meta.elapsedMs / 1000).toFixed(1)}s` : '';

  entry.innerHTML = `
    <div class="log-header">
      <span class="log-title">${title}</span>
      <span class="log-time">${timeStr}</span>
    </div>
    <div class="log-body">
      ${meta ? `<div class="log-meta">Model: <strong>${meta.model}</strong> | Tokens: ${meta.promptTokens} in / ${meta.completionTokens} out / ${meta.totalTokens} total</div>` : ''}
      <div class="log-data">${bodyHtml}</div>
    </div>
  `;

  entry.querySelector('.log-header')!.addEventListener('click', () => {
    entry.classList.toggle('open');
  });

  $output.prepend(entry);
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function apiCall<T>(method: string, path: string, body?: unknown): Promise<{ data: T; meta: CallMeta | null }> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }

  // Endpoints that wrap results have data+meta; simple endpoints return raw
  if ('data' in json && 'meta' in json) {
    return { data: json.data as T, meta: json.meta as CallMeta | null };
  }
  return { data: json as T, meta: null };
}

// ── Config display ──

async function loadConfig() {
  try {
    const { data } = await apiCall<DebugConfig>('GET', '/config');
    cfg = data;

    const ai = cfg.aiPatterns;
    $configGrid.innerHTML = `
      <span class="label">Model</span><span class="value">${cfg.model}</span>
      <span class="label">Fast Model</span><span class="value">${cfg.modelFast}</span>
      <span class="label">LLM Enabled</span><span class="value ${cfg.llmEnabled ? '' : 'off'}">${cfg.llmEnabled ? 'ON' : 'OFF'}</span>
      <span class="label">Base URL</span><span class="value">${cfg.baseURL}</span>
      <span class="label">Chaining</span><span class="value ${ai.chainingEnabled ? '' : 'off'}">${ai.chainingEnabled ? 'ON' : 'OFF'}</span>
      <span class="label">Evaluator</span><span class="value ${ai.evaluatorEnabled ? '' : 'off'}">${ai.evaluatorEnabled ? `ON (≥${ai.evaluatorThreshold ?? 7})` : 'OFF'}</span>
      <span class="label">Routing</span><span class="value ${ai.routingEnabled ? '' : 'off'}">${ai.routingEnabled ? 'ON' : 'OFF'}</span>
      <span class="label">Quests/Arc</span><span class="value">${cfg.storyArc.questsPerArc}</span>
    `;

    // Populate NPC select
    $npcSelect.innerHTML = cfg.npcIds.map(id => `<option value="${id}">${id}</option>`).join('');

    if (!cfg.llmEnabled) {
      $btnArc.disabled = true;
      $btnStandalone.disabled = true;
      addLogEntry('LLM Disabled', null, 'Set LLM_ENABLED=true and LLM_API_KEY in server/.env to enable.', true);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    $configGrid.innerHTML = `<span class="value off">Failed to load config: ${escHtml(errMsg)}</span>`;
  }
}

async function loadSession() {
  try {
    const { data } = await apiCall<SessionState>('GET', '/session');
    if (data.hasArc) {
      $btnLore.disabled = false;
    }
  } catch {
    // Ignore — fresh session
  }
}

// ── Button builders ──

function buildQuestButtons(count: number) {
  arcQuestCount = count;
  questGenerated = new Array(count).fill(false);
  $questBtns.innerHTML = '';
  $evalBtns.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const label = isLast ? `Boss Quest ${i}` : `Quest ${i}`;

    const qBtn = document.createElement('button');
    qBtn.textContent = label;
    qBtn.id = `btn-quest-${i}`;
    qBtn.addEventListener('click', () => generateQuest(i));
    $questBtns.appendChild(qBtn);

    const eBtn = document.createElement('button');
    eBtn.textContent = `Eval ${i}`;
    eBtn.id = `btn-eval-${i}`;
    eBtn.disabled = true;
    eBtn.addEventListener('click', () => evaluateQuest(i));
    $evalBtns.appendChild(eBtn);
  }
}

function clearPipelineButtons() {
  $questBtns.innerHTML = '';
  $evalBtns.innerHTML = '';
  $btnLore.disabled = true;
  arcQuestCount = 0;
  questGenerated = [];
}

// ── Actions ──

async function generateArc() {
  if (inflight) return;
  inflight = true;
  setLoading($btnArc, true);
  try {
    const { data, meta } = await apiCall<{ id: string; title: string; theme: string; quests: { summary: string; npcId: string; questType: string }[] }>('POST', '/arc');
    $btnLore.disabled = false;
    buildQuestButtons(data.quests.length);

    const questLines = data.quests.map((q, i) => {
      const boss = i === data.quests.length - 1 ? '<strong>BOSS</strong> ' : '';
      return `  [${i}] ${boss}${escHtml(q.questType)} — ${escHtml(q.npcId)}: ${escHtml(q.summary)}`;
    }).join('\n');

    addLogEntry('Generate Arc', meta, `Arc: "${escHtml(data.title)}"\nTheme: ${escHtml(data.theme)}\nQuests: ${data.quests.length}\n${questLines}`);
  } catch (err: unknown) {
    addLogEntry('Generate Arc — ERROR', null, escHtml(err instanceof Error ? err.message : String(err)), true);
  } finally {
    setLoading($btnArc, false);
    inflight = false;
  }
}

async function generateLore() {
  if (inflight) return;
  inflight = true;
  setLoading($btnLore, true);
  try {
    const { data, meta } = await apiCall<{ locations: { name: string; description: string }[]; faction: { name: string; description: string }; history: string; artifact: { name: string; description: string } }>('POST', '/lore');

    const locs = data.locations.map(l => `  • ${escHtml(l.name)}: ${escHtml(l.description)}`).join('\n');
    addLogEntry('Generate Lore', meta,
      `Locations:\n${locs}\nFaction: ${escHtml(data.faction.name)} — ${escHtml(data.faction.description)}\nHistory: ${escHtml(data.history)}\nArtifact: ${escHtml(data.artifact.name)} — ${escHtml(data.artifact.description)}`
    );
  } catch (err: unknown) {
    addLogEntry('Generate Lore — ERROR', null, escHtml(err instanceof Error ? err.message : String(err)), true);
  } finally {
    setLoading($btnLore, false);
    inflight = false;
  }
}

async function generateQuest(index: number) {
  if (inflight) return;
  inflight = true;
  const btn = document.getElementById(`btn-quest-${index}`) as HTMLButtonElement;
  setLoading(btn, true);
  try {
    const { data, meta } = await apiCall<{ quest: { id: string; name: string; type: string; npcId: string; description: string; intro?: string[]; objectives: { type: string; target: string; requiredCount: number }[]; dialog: QuestDialog; narration?: { onComplete?: string[]; onBossEncounter?: string[]; onBossDefeat?: string[] }; variants?: { monsters?: { variantId: string; name: string; baseType: string }[]; items?: { variantId: string; name: string }[] } }; validation: { valid: boolean; errors: string[] } }>('POST', '/quest', { questIndex: index });

    questGenerated[index] = true;
    const evalBtn = document.getElementById(`btn-eval-${index}`) as HTMLButtonElement;
    if (evalBtn) evalBtn.disabled = false;

    const q = data.quest;
    const objectives = q.objectives.map(o => `  • ${o.type}: ${o.target} x${o.requiredCount}`).join('\n');
    let variantStr = '';
    if (q.variants?.monsters?.length) {
      variantStr += '\nVariant Monsters:\n' + q.variants.monsters.map(m => `  • ${escHtml(m.name)} (base: ${m.baseType})`).join('\n');
    }
    if (q.variants?.items?.length) {
      variantStr += '\nVariant Items:\n' + q.variants.items.map(i => `  • ${escHtml(i.name)}`).join('\n');
    }

    let introStr = '';
    if (q.intro?.length) {
      introStr = '\n\n<div class="dialog-section-title">Intro</div>\n' + q.intro.map(l => `  <span class="dialog-intro">${escHtml(l)}</span>`).join('\n');
    }

    const dialogStr = '\n\n<div class="dialog-section-title">Dialog</div>\n' + formatDialog(q.dialog);

    let narrationStr = '';
    if (q.narration) {
      const parts: string[] = [];
      if (q.narration.onComplete?.length) parts.push('On Complete:\n' + q.narration.onComplete.map(l => `  "${escHtml(l)}"`).join('\n'));
      if (q.narration.onBossEncounter?.length) parts.push('On Boss Encounter:\n' + q.narration.onBossEncounter.map(l => `  "${escHtml(l)}"`).join('\n'));
      if (q.narration.onBossDefeat?.length) parts.push('On Boss Defeat:\n' + q.narration.onBossDefeat.map(l => `  "${escHtml(l)}"`).join('\n'));
      if (parts.length) narrationStr = '\n\n<div class="dialog-section-title">Narration</div>\n' + parts.join('\n');
    }

    const validClass = data.validation.valid ? 'valid' : 'invalid';
    const validText = data.validation.valid ? 'VALID' : `INVALID: ${data.validation.errors.join(', ')}`;

    addLogEntry(`Quest ${index}: ${escHtml(q.name)}`, meta,
      `Type: ${q.type} | NPC: ${q.npcId}\n${escHtml(q.description)}\nObjectives:\n${objectives}${variantStr}${introStr}${dialogStr}${narrationStr}\n<div class="log-validation ${validClass}">${escHtml(validText)}</div>`
    );
  } catch (err: unknown) {
    addLogEntry(`Quest ${index} — ERROR`, null, escHtml(err instanceof Error ? err.message : String(err)), true);
  } finally {
    setLoading(btn, false);
    inflight = false;
  }
}

async function evaluateQuest(index: number) {
  if (inflight) return;
  inflight = true;
  const btn = document.getElementById(`btn-eval-${index}`) as HTMLButtonElement;
  setLoading(btn, true);
  try {
    const { data, meta } = await apiCall<{ scores: Record<string, number>; average: number; critique: string }>('POST', '/evaluate', { questIndex: index });

    const scoreBars = Object.entries(data.scores).map(([key, val]) => {
      const cls = scoreClass(val);
      return `<span class="score-bar ${cls}">${key.replace(/_/g, ' ')}=${val}</span>`;
    }).join('');

    const avgCls = scoreClass(data.average);
    addLogEntry(`Evaluate Quest ${index}`, meta,
      `${scoreBars}\nAverage: <span class="score-bar ${avgCls}">${data.average.toFixed(1)}</span>\nCritique: ${escHtml(data.critique)}`
    );
  } catch (err: unknown) {
    addLogEntry(`Evaluate Quest ${index} — ERROR`, null, escHtml(err instanceof Error ? err.message : String(err)), true);
  } finally {
    setLoading(btn, false);
    inflight = false;
  }
}

async function generateStandalone() {
  if (inflight) return;
  inflight = true;
  setLoading($btnStandalone, true);
  const npcId = $npcSelect.value;
  const tier = parseInt((document.getElementById('tier-select') as HTMLSelectElement).value, 10);
  try {
    const { data, meta } = await apiCall<{ quest: { id: string; name: string; type: string; npcId: string; description: string; intro?: string[]; objectives: { type: string; target: string; requiredCount: number }[]; dialog: QuestDialog; narration?: { onComplete?: string[]; onBossEncounter?: string[]; onBossDefeat?: string[] } }; validation: { valid: boolean; errors: string[] } }>('POST', '/standalone', { npcId, tier });

    const q = data.quest;
    const objectives = q.objectives.map(o => `  • ${o.type}: ${o.target} x${o.requiredCount}`).join('\n');

    let introStr = '';
    if (q.intro?.length) {
      introStr = '\n\n<div class="dialog-section-title">Intro</div>\n' + q.intro.map(l => `  <span class="dialog-intro">${escHtml(l)}</span>`).join('\n');
    }

    const dialogStr = '\n\n<div class="dialog-section-title">Dialog</div>\n' + formatDialog(q.dialog);

    let narrationStr = '';
    if (q.narration) {
      const parts: string[] = [];
      if (q.narration.onComplete?.length) parts.push('On Complete:\n' + q.narration.onComplete.map(l => `  "${escHtml(l)}"`).join('\n'));
      if (parts.length) narrationStr = '\n\n<div class="dialog-section-title">Narration</div>\n' + parts.join('\n');
    }

    const validClass = data.validation.valid ? 'valid' : 'invalid';
    const validText = data.validation.valid ? 'VALID' : `INVALID: ${data.validation.errors.join(', ')}`;

    addLogEntry(`Standalone: ${escHtml(q.name)}`, meta,
      `NPC: ${q.npcId} | Type: ${q.type} | Tier: ${tier}\n${escHtml(q.description)}\nObjectives:\n${objectives}${introStr}${dialogStr}${narrationStr}\n<div class="log-validation ${validClass}">${escHtml(validText)}</div>`
    );
  } catch (err: unknown) {
    addLogEntry(`Standalone — ERROR`, null, escHtml(err instanceof Error ? err.message : String(err)), true);
  } finally {
    setLoading($btnStandalone, false);
    inflight = false;
  }
}

async function resetSession() {
  try {
    await apiCall('DELETE', '/session');
    clearPipelineButtons();
    $output.innerHTML = '<div class="empty-state">Session reset. Generate an arc to begin.</div>';
  } catch (err: unknown) {
    addLogEntry('Reset — ERROR', null, escHtml(err instanceof Error ? err.message : String(err)), true);
  }
}

// ── Wire up ──

$btnArc.addEventListener('click', generateArc);
$btnLore.addEventListener('click', generateLore);
$btnStandalone.addEventListener('click', generateStandalone);
$btnReset.addEventListener('click', resetSession);

// ── Init ──

loadConfig();
loadSession();
