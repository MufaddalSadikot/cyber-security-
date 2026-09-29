/** Popup UI: sends the task to the service worker and renders the result. */
const taskEl = document.getElementById('task') as HTMLInputElement;
const runEl = document.getElementById('run') as HTMLButtonElement;
const outEl = document.getElementById('out') as HTMLDivElement;

runEl.addEventListener('click', async () => {
  runEl.disabled = true;
  runEl.textContent = 'Running on device…';
  outEl.innerHTML = '';
  try {
    const res = await chrome.runtime.sendMessage({ type: 'PVCC_RUN', task: taskEl.value });
    if (res?.error) {
      outEl.innerHTML = `<div class="block badge">error</div><p>${res.error}</p>`;
      return;
    }
    const d = res.decision;
    const cls = d.decision === 'ALLOW' ? 'allow' : d.decision === 'BLOCK' ? 'block' : 'confirm';
    outEl.innerHTML = `
      <div class="row"><span class="k">Sensitive found</span><span>${res.entities.length}</span></div>
      <div class="row"><span class="k">Context reduction</span><span>${res.stats.reductionPct}%</span></div>
      <div class="row"><span class="k">Proposed action</span><span>${res.action.type}</span></div>
      <div class="row"><span class="k">Policy</span><span class="badge ${cls}">${d.decision}</span></div>
      <div class="row"><span class="k">Executed</span><span>${res.executed ? '✓' : '—'}</span></div>
      <p style="color:#7c89a8;margin:8px 0 4px">${d.reason}</p>
      <pre>${JSON.stringify(res.action, null, 2)}</pre>
    `;
  } catch (e) {
    outEl.innerHTML = `<div class="block badge">error</div><p>${String(e)}</p>`;
  } finally {
    runEl.disabled = false;
    runEl.textContent = 'Run on this page';
  }
});
