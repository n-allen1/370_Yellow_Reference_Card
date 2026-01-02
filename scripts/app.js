const tbody = document.getElementById('tbody');

const rrInst = 'R<sub>1</sub>,R<sub>2</sub>';
const qstInst = 'VR<sub>1</sub>,FR<sub>3</sub>,RS<sub>2</sub>(RT<sub>2</sub>)';
const qvInst = 'VR<sub>1</sub>,FR<sub>3</sub>,VR<sub>2</sub>';
const rreInst = 'R<sub>1</sub>';
const rsInst = 'R<sub>1</sub>,R<sub>3</sub>,D<sub>2</sub>(B<sub>2</sub>)';
const rxInst = 'R<sub>1</sub>,D<sub>2</sub>(X<sub>2</sub>,B<sub>2</sub>)';
const sInst = 'D<sub>2</sub>(B<sub>2</sub>)';
const siInst = 'D<sub>1</sub>(B<sub>1</sub>),I<sub>2</sub>';
const vrInst = 'VR<sub>1</sub>,FR<sub>3</sub>,GR<sub>2</sub>';
const vsInst = 'RS<sub>2</sub>';
const vstInst = 'M<sub>1</sub>,VR<sub>3</sub>,RS<sub>2</sub>(RT<sub>2</sub>)';
const vvInst = 'M<sub>1</sub>,VR<sub>3</sub>,VR<sub>2</sub>';
const rseInst = 'VR<sub>1</sub>,GR<sub>3</sub>,D<sub>2</sub>(B<sub>2</sub>)';
const ss1Inst =
  'D<sub>1</sub>(L<sub>1</sub>,B<sub>1</sub>),D<sub>2</sub>(L<sub>2</sub>,B<sub>2</sub>)';
const ss2Inst = 'D<sub>1</sub>(L,B<sub>1</sub>),D<sub>2</sub>(B<sub>2</sub>)';
const ss3Inst =
  'D<sub>1</sub>(R<sub>1</sub>,B<sub>1</sub>),D<sub>2</sub>(B<sub>2</sub>),R<sub>3</sub>';
const sseInst = 'D<sub>1</sub>(B<sub>1</sub>),D<sub>2</sub>(B<sub>2</sub>)';

let ALL = [];

fetch('../instructions.json')
  .then((response) => {
    if (!response.ok) {
      throw new Error('Failed to load JSON');
    }
    return response.json();
  })
  .then((data) => {
    ALL = Array.isArray(data) ? data : [];
    renderTable(ALL);
    setupSearch();
  })
  .catch((err) => {
    console.error(err);
  });

function renderTable(instructions) {
  tbody.innerHTML = '';

  instructions.forEach((inst) => {
    const tr = document.createElement('tr');
    const operandFormats = {
      RR: rrInst,
      QST: qstInst,
      QV: qvInst,
      RRE: rreInst,
      RS: rsInst,
      RX: rxInst,
      S: sInst,
      SI: siInst,
      VR: vrInst,
      VS: vsInst,
      VST: vstInst,
      VV: vvInst,
      RSE: rseInst,
      SSE: sseInst,
    };

    inst.operands = operandFormats[inst.format] ?? inst.operands;
    if (inst.operands === 'D1(L1,B1),D2(L2,B2)') {
      inst.operands = ss1Inst;
    } else if (inst.operands === 'D1(L,B1),D2(B2)') {
      inst.operands = ss2Inst;
    } else if (inst.operands === 'D1(R1,B1),D2(B2),R3') {
      inst.operands = ss3Inst;
    }

    tr.innerHTML = `
        <td class="op">${inst.op_code ?? ''}</td>
        <td>${inst.mnemonic ?? ''}</td>
        <td>${inst.name ?? ''}</td>
        <td>${inst.format ?? ''}</td>
        <td class="operands">${inst.operands}</td>
        <td>${renderNotes(inst)}</td>`;

    tbody.appendChild(tr);
  });
}

function renderNotes(inst) {
  const flags = [];

  if (inst.sets_conditionCode)
    flags.push(`<span class="flag-pill flag-cc" title="Sets Condition Code">c</span>`);
  if (inst.is_privileged)
    flags.push(`<span class="flag-pill flag-priv" title="Privileged Instruction">p</span>`);
  if (inst.is_semiPrivileged)
    flags.push(`<span class="flag-pill flag-semi" title="Semi-Privileged Instruction">q</span>`);
  if (inst.is_interruptible)
    flags.push(`<span class="flag-pill flag-int" title="Interruptible">i</span>`);
  if (inst.is_interruptible)
    flags.push(`<span class="flag-pill flag-lCC" title="Loads New Condition Code">n</span>`);

  return flags.join('');
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const fieldChecks = Array.from(document.querySelectorAll('input[type="checkbox"][data-field]'));

  const getActiveFields = () =>
    fieldChecks.filter((cb) => cb.checked).map((cb) => cb.dataset.field);

  const run = () => {
    const q = (input?.value ?? '').trim();
    const fields = getActiveFields();
    const filtered = filterInstructions(ALL, q, fields);

    renderTable(filtered);
    updateResultCount(filtered.length);
  };

  input?.addEventListener('input', run);

  fieldChecks.forEach((cb) => cb.addEventListener('change', run));

  clearBtn?.addEventListener('click', () => {
    if (input) input.value = '';
    renderTable(ALL);
    input?.focus();
    updateResultCount(393);
  });
}

function filterInstructions(list, query, activeFields) {
  if (!query) return list;

  const tokens = query.toUpperCase().split(/\s+/).filter(Boolean);

  const fields = activeFields.length
    ? activeFields
    : ['op_code', 'mnemonic', 'name', 'operands', 'format'];

  const norm = (v) => String(v ?? '').toUpperCase();
  const fieldValue = (inst, field) => norm(inst[field]);

  return list
    .map((inst) => ({ inst, score: scoreInst(inst, tokens, fields, fieldValue) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.inst);
}

function scoreInst(inst, tokens, fields, fieldValue) {
  let total = 0;

  for (const t of tokens) {
    let bestTokenScore = 0;

    for (const f of fields) {
      const v = fieldValue(inst, f);
      if (!v) continue;

      if (v === t) bestTokenScore = Math.max(bestTokenScore, 100);
      else if ((f === 'op_code' || f === 'mnemonic') && v.startsWith(t))
        bestTokenScore = Math.max(bestTokenScore, 70);
      else if (v.includes(t)) bestTokenScore = Math.max(bestTokenScore, 35);
    }

    if (bestTokenScore === 0) return 0;

    total += bestTokenScore;
  }

  return total;
}

function updateResultCount(count) {
  document.getElementById('resultCount').textContent = `${count} results`;
}
