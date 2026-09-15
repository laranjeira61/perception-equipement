const GRADES_GENDARMERIE = [
  "Gendarme adjoint volontaire",
  "Brigadier",
  "Brigadier-chef",
  "Gendarme",
  "Maréchal des logis-chef",
  "Adjudant",
  "Adjudant-chef",
  "Major",
  "Aspirant",
  "Sous-lieutenant",
  "Lieutenant",
  "Capitaine",
  "Chef d'escadron",
  "Lieutenant-colonel",
  "Colonel",
  "Général de brigade",
  "Général de division",
  "Général de corps d'armée",
  "Général d'armée"
];

document.addEventListener('DOMContentLoaded', async () => {

  // ---------- Navigation entre vues ----------
  const tabBtns = document.querySelectorAll('.tab-btn');
  const views = document.querySelectorAll('.view');

  function showView(name) {
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.view === 'form') await resetFormToNew();
      showView(btn.dataset.view);
    });
  });

  // ---------- Init date par défaut ----------
  const dateInput = document.getElementById('date-mission');
  function nowLocalISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  dateInput.value = nowLocalISO();

  // ---------- Grades ----------
  function populateGradeSelects() {
    const options = '<option value="">-- Sélectionner --</option>' +
      GRADES_GENDARMERIE.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
    document.querySelectorAll('.grade-select').forEach(sel => { sel.innerHTML = options; });
  }
  populateGradeSelects();

  // ---------- Autocomplétion personnes (nom -> NIGEND + grade) ----------
  let infosParNom = { reserviste: {}, gendarme: {} };

  async function refreshDatalists() {
    const reservistes = await DB.getPersonnesByRole('reserviste');
    const gendarmes = await DB.getPersonnesByRole('gendarme');

    infosParNom.reserviste = Object.fromEntries(reservistes.map(p => [p.nom, { nigend: p.nigend || '', grade: p.grade || '' }]));
    infosParNom.gendarme = Object.fromEntries(gendarmes.map(p => [p.nom, { nigend: p.nigend || '', grade: p.grade || '' }]));

    document.getElementById('dl-reservistes').innerHTML =
      reservistes.map(p => `<option value="${escapeHtml(p.nom)}">`).join('');
    document.getElementById('dl-gendarmes').innerHTML =
      gendarmes.map(p => `<option value="${escapeHtml(p.nom)}">`).join('');
  }
  await refreshDatalists();

  function bindPersonAutofill(nomInputId, nigendInputId, gradeInputId, role) {
    const nomInput = document.getElementById(nomInputId);
    const nigendInput = document.getElementById(nigendInputId);
    const gradeInput = document.getElementById(gradeInputId);
    nomInput.addEventListener('input', () => {
      const match = infosParNom[role][nomInput.value.trim()];
      if (match) {
        if (match.nigend) nigendInput.value = match.nigend;
        if (match.grade) gradeInput.value = match.grade;
      }
    });
  }
  bindPersonAutofill('nom-reserviste', 'nigend-reserviste', 'grade-reserviste', 'reserviste');
  bindPersonAutofill('nom-gendarme', 'nigend-gendarme', 'grade-gendarme', 'gendarme');
  bindPersonAutofill('nom-gendarme-restitution', 'nigend-gendarme-restitution', 'grade-gendarme-restitution', 'gendarme');

  // ---------- Autocomplétion des unités ----------
  let unitesConnues = (await DB.getReglage('unites_connues')) || [];

  function refreshUniteDatalist() {
    document.getElementById('dl-unites').innerHTML =
      unitesConnues.map(u => `<option value="${escapeHtml(u)}">`).join('');
  }
  refreshUniteDatalist();

  async function memoriserUnite(unite) {
    if (!unite) return;
    const dejaConnue = unitesConnues.some(u => u.toLowerCase() === unite.toLowerCase());
    if (dejaConnue) return;
    unitesConnues.push(unite);
    await DB.setReglage('unites_connues', unitesConnues);
    refreshUniteDatalist();
  }

  // ---------- Lignes d'équipement ----------
  const equipTbody = document.getElementById('equip-tbody');
  const rowTemplate = document.getElementById('equip-row-template');

  // ---------- Auto-complétion des numéros de série (par désignation) ----------
  let seriesConnues = (await DB.getReglage('series_connues')) || {};

  function cleDesignation(designation) {
    return (designation || '').trim().toLowerCase();
  }

  function updateSeriesDatalist(serialInput) {
    const row = serialInput.closest('tr');
    const designation = cleDesignation(row.querySelector('.equip-designation').value);
    const options = seriesConnues[designation] || [];
    document.getElementById('dl-series').innerHTML = options.map(s => `<option value="${escapeHtml(s)}">`).join('');
  }

  equipTbody.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('equip-serial')) updateSeriesDatalist(e.target);
  });

  function memoriserSerie(designation, serie) {
    if (!serie) return;
    const cle = cleDesignation(designation);
    if (!cle) return;
    if (!seriesConnues[cle]) seriesConnues[cle] = [];
    if (!seriesConnues[cle].includes(serie)) seriesConnues[cle].push(serie);
  }

  function addEquipRow(prefill) {
    const clone = rowTemplate.content.cloneNode(true);
    if (prefill) {
      clone.querySelector('.equip-designation').value = prefill.designation || '';
      clone.querySelector('.equip-qty').value = prefill.quantite || 1;
      const serialInput = clone.querySelector('.equip-serial');
      if (prefill.serie) serialInput.value = prefill.serie;
      if (prefill.serieRequise === true) {
        serialInput.required = true;
        serialInput.placeholder = 'Obligatoire';
      } else if (prefill.serieRequise === false) {
        serialInput.style.display = 'none';
      }
      if (prefill.remis === false) clone.querySelector('.equip-remis').checked = false;
    }
    clone.querySelector('.btn-del-row').addEventListener('click', (e) => {
      e.target.closest('tr').remove();
    });
    equipTbody.appendChild(clone);
  }
  document.getElementById('btn-add-row').addEventListener('click', () => addEquipRow());

  async function loadDefaultEquipRows() {
    const defauts = await DB.getReglage('equipements_defaut');
    equipTbody.innerHTML = '';
    if (defauts && defauts.length) {
      defauts.forEach(d => addEquipRow(d));
    } else {
      addEquipRow();
    }
  }
  await loadDefaultEquipRows();

  // ---------- Assistant en étapes (Nouvelle fiche) ----------
  const wizardSteps = [...document.querySelectorAll('#fiche-form .wizard-step')];
  const wizardDots = [...document.querySelectorAll('.wizard-dots .dot')];
  const wizardStepNum = document.getElementById('wizard-step-num');
  const wizardStepTitle = document.getElementById('wizard-step-title');
  const wizardStepTitles = ['Mission', 'Personnes', 'Équipement', 'Signatures'];
  const btnWizardPrev = document.getElementById('btn-wizard-prev');
  const btnWizardNext = document.getElementById('btn-wizard-next');
  const btnWizardSubmit = document.getElementById('btn-wizard-submit');
  let wizardCurrentStep = 1;

  function goToWizardStep(n) {
    wizardCurrentStep = n;
    wizardSteps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
    wizardDots.forEach(d => d.classList.toggle('active', Number(d.dataset.step) === n));
    wizardStepNum.textContent = n;
    wizardStepTitle.textContent = wizardStepTitles[n - 1];
    btnWizardPrev.disabled = n === 1;
    btnWizardNext.hidden = n === wizardSteps.length;
    btnWizardSubmit.hidden = n !== wizardSteps.length;
    if (n === wizardSteps.length) {
      sigReserviste.resize();
      sigGendarme.resize();
    }
  }

  function wizardStepIsValid(n) {
    const step = wizardSteps[n - 1];
    const invalid = step.querySelector(':invalid');
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  btnWizardNext.addEventListener('click', () => {
    if (!wizardStepIsValid(wizardCurrentStep)) return;
    goToWizardStep(wizardCurrentStep + 1);
  });
  btnWizardPrev.addEventListener('click', () => goToWizardStep(wizardCurrentStep - 1));

  // ---------- Signatures ----------
  const sigPads = {};
  function makeSigPad(canvasId) {
    const pad = initSignaturePad(document.getElementById(canvasId));
    sigPads[canvasId] = pad;
    return pad;
  }

  const sigReserviste = makeSigPad('sig-reserviste');
  const sigGendarme = makeSigPad('sig-gendarme');
  const sigRestReserviste = makeSigPad('sig-restitution-reserviste');
  const sigRestGendarme = makeSigPad('sig-restitution-gendarme');

  document.querySelectorAll('.btn-clear-sig').forEach(btn => {
    btn.addEventListener('click', () => sigPads[btn.dataset.target].clear());
  });

  // ---------- Édition d'une fiche existante ----------
  let editingFicheId = null;
  let editingOriginalEnregistreLe = null;

  async function resetFormToNew() {
    editingFicheId = null;
    editingOriginalEnregistreLe = null;
    btnWizardSubmit.textContent = 'Enregistrer la fiche';
    form.reset();
    dateInput.value = nowLocalISO();
    await loadDefaultEquipRows();
    sigReserviste.clear();
    sigGendarme.clear();
    goToWizardStep(1);
  }

  async function openEditFiche(id) {
    const f = await DB.getFiche(id);
    if (!f) return;
    if (f.reintegre) {
      alert('Cette fiche a déjà été réintégrée et ne peut plus être modifiée.');
      return;
    }

    editingFicheId = f.id;
    editingOriginalEnregistreLe = f.enregistreLe;
    btnWizardSubmit.textContent = 'Enregistrer les modifications';

    dateInput.value = f.dateMission;
    document.getElementById('unite-mission').value = f.unite;
    document.getElementById('nom-reserviste').value = f.reserviste;
    document.getElementById('nigend-reserviste').value = f.nigendReserviste;
    document.getElementById('grade-reserviste').value = f.gradeReserviste;
    document.getElementById('nom-gendarme').value = f.gendarme;
    document.getElementById('nigend-gendarme').value = f.nigendGendarme;
    document.getElementById('grade-gendarme').value = f.gradeGendarme;

    equipTbody.innerHTML = '';
    f.equipement.forEach(e => addEquipRow(e));

    sigReserviste.clear();
    sigGendarme.clear();
    sigReserviste.loadDataURL(f.signatureReserviste);
    sigGendarme.loadDataURL(f.signatureGendarme);

    showView('form');
    goToWizardStep(1);
  }

  // ---------- Soumission du formulaire ----------
  const form = document.getElementById('fiche-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (sigReserviste.isEmpty() || sigGendarme.isEmpty()) {
      alert('Les deux signatures sont requises avant enregistrement.');
      return;
    }

    const equipRows = [...equipTbody.querySelectorAll('tr')].map(row => ({
      remis: row.querySelector('.equip-remis').checked,
      designation: row.querySelector('.equip-designation').value.trim(),
      quantite: Number(row.querySelector('.equip-qty').value) || 1,
      serie: row.querySelector('.equip-serial').value.trim()
    })).filter(r => r.designation);

    if (equipRows.length === 0) {
      alert('Ajoutez au moins une ligne d\'équipement.');
      return;
    }

    const nomReserviste = document.getElementById('nom-reserviste').value.trim();
    const nomGendarme = document.getElementById('nom-gendarme').value.trim();
    const nigendReserviste = document.getElementById('nigend-reserviste').value.trim();
    const nigendGendarme = document.getElementById('nigend-gendarme').value.trim();
    const gradeReserviste = document.getElementById('grade-reserviste').value;
    const gradeGendarme = document.getElementById('grade-gendarme').value;
    const unite = document.getElementById('unite-mission').value.trim();
    const isEditing = !!editingFicheId;

    const fiche = {
      id: isEditing ? editingFicheId : ('fiche-' + Date.now()),
      dateMission: dateInput.value,
      unite,
      reserviste: nomReserviste,
      nigendReserviste,
      gradeReserviste,
      gendarme: nomGendarme,
      nigendGendarme,
      gradeGendarme,
      equipement: equipRows,
      signatureReserviste: sigReserviste.toDataURL(),
      signatureGendarme: sigGendarme.toDataURL(),
      enregistreLe: isEditing ? editingOriginalEnregistreLe : new Date().toISOString(),
      reintegre: false
    };
    if (isEditing) fiche.modifieLe = new Date().toISOString();

    await DB.saveFiche(fiche);
    await DB.upsertPersonne(nomReserviste, 'reserviste', nigendReserviste, gradeReserviste);
    await DB.upsertPersonne(nomGendarme, 'gendarme', nigendGendarme, gradeGendarme);
    equipRows.forEach(r => memoriserSerie(r.designation, r.serie));
    await DB.setReglage('series_connues', seriesConnues);
    await memoriserUnite(unite);
    await refreshDatalists();

    const message = isEditing ? 'Fiche modifiée.' : 'Fiche enregistrée.';
    await resetFormToNew();

    alert(message);
    showView('history');
  });

  // ---------- Historique ----------
  const historyList = document.getElementById('history-list');
  const searchInput = document.getElementById('search-history');
  const filterDate = document.getElementById('filter-date');
  let allFiches = [];

  function todayISODate() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  filterDate.value = todayISODate();

  async function renderHistory() {
    allFiches = await DB.getAllFiches();
    filterAndRenderHistory();
  }

  function filterAndRenderHistory() {
    const q = searchInput.value.trim().toLowerCase();
    const selectedDate = filterDate.value;

    const filtered = allFiches.filter(f => {
      const matchesText = !q || [f.reserviste, f.gendarme, f.unite].some(v => (v || '').toLowerCase().includes(q));
      const ficheDate = (f.dateMission || '').slice(0, 10);
      const matchesDate = !selectedDate || ficheDate === selectedDate;
      return matchesText && matchesDate;
    });

    if (filtered.length === 0) {
      historyList.innerHTML = selectedDate
        ? `<div class="history-empty">Aucune fiche pour le ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR')}.</div>`
        : '<div class="history-empty">Aucune fiche enregistrée.</div>';
      return;
    }

    historyList.innerHTML = filtered.map(f => `
      <div class="history-item ${f.reintegre ? 'reintegre' : ''}" data-id="${f.id}">
        <div class="h-status">
          ${f.reintegre
            ? '<span class="badge-reintegre">✓ Réintégré</span>'
            : `<button type="button" class="btn-secondary btn-restituer" data-id="${f.id}">Réintégrer</button>`}
          <div class="h-mini-actions">
            <button type="button" class="btn-link edit btn-edit-fiche" data-id="${f.id}"
              ${f.reintegre ? 'disabled title="Fiche déjà réintégrée, modification impossible"' : ''}>Modifier</button>
            <button type="button" class="btn-link danger btn-delete-fiche" data-id="${f.id}">Supprimer</button>
          </div>
        </div>
        <div class="h-body">
          <div class="h-title">${escapeHtml(f.reserviste)} — ${escapeHtml(f.unite)}</div>
          <div class="h-sub">${formatDate(f.dateMission)} · remis par ${escapeHtml(f.gendarme)}</div>
        </div>
      </div>
    `).join('');

    historyList.querySelectorAll('.h-body').forEach(el => {
      el.addEventListener('click', () => openPrintView(el.closest('.history-item').dataset.id));
    });

    historyList.querySelectorAll('.btn-restituer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRestitutionView(btn.dataset.id);
      });
    });

    historyList.querySelectorAll('.btn-edit-fiche').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditFiche(btn.dataset.id);
      });
    });

    historyList.querySelectorAll('.btn-delete-fiche').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Supprimer définitivement cette fiche ? Cette action est irréversible.')) return;
        await DB.deleteFiche(btn.dataset.id);
        await renderHistory();
      });
    });
  }

  searchInput.addEventListener('input', filterAndRenderHistory);
  filterDate.addEventListener('change', filterAndRenderHistory);

  function shiftFilterDate(days) {
    const base = filterDate.value ? new Date(filterDate.value + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    base.setMinutes(base.getMinutes() - base.getTimezoneOffset());
    filterDate.value = base.toISOString().slice(0, 10);
    filterAndRenderHistory();
  }

  document.getElementById('btn-prev-day').addEventListener('click', () => shiftFilterDate(-1));
  document.getElementById('btn-next-day').addEventListener('click', () => shiftFilterDate(1));
  document.getElementById('btn-today').addEventListener('click', () => {
    filterDate.value = todayISODate();
    filterAndRenderHistory();
  });
  document.getElementById('btn-all-dates').addEventListener('click', () => {
    filterDate.value = '';
    filterAndRenderHistory();
  });

  // ---------- Vue détail / impression ----------
  const printContent = document.getElementById('print-content');

  async function openPrintView(id) {
    const f = await DB.getFiche(id);
    if (!f) return;

    let restitutionHtml = '';
    if (f.restitution) {
      const r = f.restitution;
      restitutionHtml = `
        <h2 class="section-title">Réintégration</h2>
        <p><strong>Réintégré le :</strong> ${formatDate(r.date)}</p>
        <p><strong>Gendarme réintégrant :</strong> ${escapeHtml(r.gradeGendarme)} ${escapeHtml(r.gendarme)} (NIGEND ${escapeHtml(r.nigendGendarme)})</p>
        <table>
          <thead><tr><th>Réintégré</th><th>Désignation</th><th>Qté</th><th>N° série</th></tr></thead>
          <tbody>
            ${(r.equipementValide || []).map(e => `
              <tr>
                <td>${e.valide ? 'Oui' : 'Non'}</td>
                <td>${escapeHtml(e.designation)}</td>
                <td>${e.quantite}</td>
                <td>${escapeHtml(e.serie || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="print-sig-grid">
          <div>
            <p><strong>Signature réserviste</strong></p>
            <img src="${r.signatureReserviste}" alt="Signature réserviste (réintégration)">
          </div>
          <div>
            <p><strong>Signature gendarme</strong></p>
            <img src="${r.signatureGendarme}" alt="Signature gendarme (réintégration)">
          </div>
        </div>
      `;
    }

    printContent.innerHTML = `
      <h2>Fiche de perception d'équipement</h2>
      <p><strong>Date / heure :</strong> ${formatDate(f.dateMission)}</p>
      <p><strong>Unité :</strong> ${escapeHtml(f.unite)}</p>
      <p><strong>Réserviste :</strong> ${escapeHtml(f.gradeReserviste)} ${escapeHtml(f.reserviste)} (NIGEND ${escapeHtml(f.nigendReserviste)})</p>
      <p><strong>Gendarme remettant :</strong> ${escapeHtml(f.gradeGendarme)} ${escapeHtml(f.gendarme)} (NIGEND ${escapeHtml(f.nigendGendarme)})</p>
      <table>
        <thead><tr><th>Remis</th><th>Désignation</th><th>Qté</th><th>N° série</th></tr></thead>
        <tbody>
          ${f.equipement.map(e => `
            <tr>
              <td>${e.remis ? 'Oui' : 'Non'}</td>
              <td>${escapeHtml(e.designation)}</td>
              <td>${e.quantite}</td>
              <td>${escapeHtml(e.serie || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="print-sig-grid">
        <div>
          <p><strong>Signature réserviste</strong></p>
          <img src="${f.signatureReserviste}" alt="Signature réserviste">
        </div>
        <div>
          <p><strong>Signature gendarme remettant</strong></p>
          <img src="${f.signatureGendarme}" alt="Signature gendarme">
        </div>
      </div>
      ${restitutionHtml}
      <p class="meta">Fiche enregistrée le ${formatDate(f.enregistreLe)}${f.modifieLe ? ` · modifiée le ${formatDate(f.modifieLe)}` : ''}</p>
    `;
    showView('print');
  }

  document.getElementById('btn-back-history').addEventListener('click', () => showView('history'));
  document.getElementById('btn-print').addEventListener('click', () => {
    document.getElementById('view-print').classList.add('print-active');
    window.print();
  });

  // ---------- Réintégration (restitution) ----------
  const restitutionInfo = document.getElementById('restitution-info');
  const restitutionEquipTbody = document.getElementById('restitution-equip-tbody');
  const restitutionRowTemplate = document.getElementById('restitution-row-template');
  let currentRestitutionFiche = null;

  async function openRestitutionView(id) {
    const f = await DB.getFiche(id);
    if (!f) return;
    currentRestitutionFiche = f;

    restitutionInfo.innerHTML = `
      <p><strong>Unité :</strong> ${escapeHtml(f.unite)}</p>
      <p><strong>Réserviste :</strong> ${escapeHtml(f.reserviste)} (NIGEND ${escapeHtml(f.nigendReserviste)})</p>
      <p><strong>Gendarme remettant initial :</strong> ${escapeHtml(f.gendarme)} (NIGEND ${escapeHtml(f.nigendGendarme)})</p>
      <p><strong>Perçu le :</strong> ${formatDate(f.dateMission)}</p>
    `;

    restitutionEquipTbody.innerHTML = '';
    f.equipement.forEach(e => {
      const clone = restitutionRowTemplate.content.cloneNode(true);
      clone.querySelector('.restitution-designation').textContent = e.designation;
      clone.querySelector('.restitution-qty').textContent = e.quantite;
      clone.querySelector('.restitution-serie').textContent = e.serie || '-';
      restitutionEquipTbody.appendChild(clone);
    });

    document.getElementById('nom-gendarme-restitution').value = '';
    document.getElementById('nigend-gendarme-restitution').value = '';
    document.getElementById('grade-gendarme-restitution').value = '';

    sigRestReserviste.clear();
    sigRestGendarme.clear();

    showView('restitution');
    sigRestReserviste.resize();
    sigRestGendarme.resize();
  }

  document.getElementById('btn-cancel-restitution').addEventListener('click', () => showView('history'));

  document.getElementById('btn-valider-restitution').addEventListener('click', async () => {
    const nomGendarmeRestitution = document.getElementById('nom-gendarme-restitution').value.trim();
    const nigendGendarmeRestitution = document.getElementById('nigend-gendarme-restitution').value.trim();
    const gradeGendarmeRestitution = document.getElementById('grade-gendarme-restitution').value;

    if (!nomGendarmeRestitution || !nigendGendarmeRestitution || !gradeGendarmeRestitution) {
      alert('Merci de renseigner le grade, le nom et le NIGEND du gendarme qui réintègre.');
      return;
    }
    if (sigRestReserviste.isEmpty() || sigRestGendarme.isEmpty()) {
      alert('Les deux signatures sont requises pour valider la réintégration.');
      return;
    }
    if (!currentRestitutionFiche) return;

    const equipementValide = [...restitutionEquipTbody.querySelectorAll('tr')].map((row, i) => ({
      ...currentRestitutionFiche.equipement[i],
      valide: row.querySelector('.restitution-valide').checked
    }));

    currentRestitutionFiche.reintegre = true;
    currentRestitutionFiche.restitution = {
      date: new Date().toISOString(),
      gendarme: nomGendarmeRestitution,
      nigendGendarme: nigendGendarmeRestitution,
      gradeGendarme: gradeGendarmeRestitution,
      equipementValide,
      signatureReserviste: sigRestReserviste.toDataURL(),
      signatureGendarme: sigRestGendarme.toDataURL()
    };

    await DB.saveFiche(currentRestitutionFiche);
    await DB.upsertPersonne(nomGendarmeRestitution, 'gendarme', nigendGendarmeRestitution, gradeGendarmeRestitution);
    await refreshDatalists();
    alert('Réintégration enregistrée.');
    showView('history');
  });

  // ---------- Réglages : équipements par défaut ----------
  const defaultEquipTbody = document.getElementById('default-equip-tbody');
  const defaultRowTemplate = document.getElementById('default-equip-row-template');
  let settingsLoaded = false;

  function addDefaultEquipRow(prefill) {
    const clone = defaultRowTemplate.content.cloneNode(true);
    if (prefill) {
      clone.querySelector('.default-equip-designation').value = prefill.designation || '';
      clone.querySelector('.default-equip-qty').value = prefill.quantite || 1;
      clone.querySelector('.default-equip-serie-requise').checked = !!prefill.serieRequise;
    }
    clone.querySelector('.btn-del-row').addEventListener('click', (e) => {
      e.target.closest('tr').remove();
    });
    clone.querySelector('.btn-move-up').addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      const prev = row.previousElementSibling;
      if (prev) row.parentNode.insertBefore(row, prev);
    });
    clone.querySelector('.btn-move-down').addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      const next = row.nextElementSibling;
      if (next) row.parentNode.insertBefore(next, row);
    });
    defaultEquipTbody.appendChild(clone);
  }

  async function renderSettings() {
    if (settingsLoaded) return; // évite d'écraser des modifs non enregistrées en revenant sur l'onglet
    settingsLoaded = true;
    const defauts = await DB.getReglage('equipements_defaut');
    defaultEquipTbody.innerHTML = '';
    if (defauts && defauts.length) {
      defauts.forEach(d => addDefaultEquipRow(d));
    } else {
      addDefaultEquipRow();
    }
  }

  document.getElementById('btn-add-default-row').addEventListener('click', () => addDefaultEquipRow());

  document.getElementById('btn-save-defaults').addEventListener('click', async () => {
    const rows = [...defaultEquipTbody.querySelectorAll('tr')].map(row => ({
      designation: row.querySelector('.default-equip-designation').value.trim(),
      quantite: Number(row.querySelector('.default-equip-qty').value) || 1,
      serieRequise: row.querySelector('.default-equip-serie-requise').checked
    })).filter(r => r.designation);

    await DB.setReglage('equipements_defaut', rows);
    alert('Réglages enregistrés. Ils seront appliqués à la prochaine nouvelle fiche.');
  });

  // ---------- Utilitaires ----------
  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ---------- Service Worker (offline) ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
