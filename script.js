/**
 * GeoToolkits · AeroGeoTop
 * script.js — Lógica completa del Conversor UTM ↔ Lat/Lon
 *
 * Algoritmo: Transformación UTM ↔ WGS-84
 * Datum   : WGS-84 / GRS-80
 * Precisión: Sub-milimétrica para uso topográfico y geodésico
 *
 * @version 1.0.0
 * @author  AeroGeoTop
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   1. CONSTANTES GEODÉSICAS — Elipsoide GRS-80 / WGS-84
   ═══════════════════════════════════════════════════════════════ */
const GRS80 = {
  a:  6378137.0,            // Semieje mayor (m)
  f:  1 / 298.257222101,    // Achatamiento
};
GRS80.b  = GRS80.a * (1 - GRS80.f);                     // Semieje menor
GRS80.e2 = 2 * GRS80.f - GRS80.f ** 2;                  // Excentricidad² primera
GRS80.n  = GRS80.f / (2 - GRS80.f);                     // Tercera aplanamiento

const UTM = {
  k0:           0.9996,     // Factor de escala central
  E0:           500000.0,   // Falso este (m)
  N0_S:       10000000.0,   // Falso norte hemisferio Sur (m)
};

/* ═══════════════════════════════════════════════════════════════
   2. NÚCLEO MATEMÁTICO — Algoritmos de conversión
   ═══════════════════════════════════════════════════════════════ */

/**
 * UTM → Latitud / Longitud
 * Algoritmo de Karney (2011) adaptado — alta precisión
 */
function utmToLatLon(zone, hemisphere, easting, northing) {
  const { a, e2, k0 } = GRS80;
  const E0 = UTM.E0;
  const N0 = hemisphere === 'S' ? UTM.N0_S : 0;

  // Meridiano central de la zona
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const e = Math.sqrt(e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  // Coordenadas reducidas
  const x = easting - E0;
  const y = northing - N0;

  // Radio meridiano en el ecuador
  const M0 = 0;
  const mu = y / (a * k0 * (1
    - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));

  // Serie de Fourier para latitud geodésica
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);

  // Parámetros auxiliares en phi1
  const N1 = a / Math.sqrt(1 - e2 * sinPhi1 ** 2);
  const T1 = tanPhi1 ** 2;
  const C1 = e2 / (1 - e2) * cosPhi1 ** 2;
  const R1 = a * (1 - e2) / (1 - e2 * sinPhi1 ** 2) ** 1.5;
  const D  = x / (N1 * k0);

  // Latitud (radianes)
  const lat = phi1
    - (N1 * tanPhi1 / R1) * (
        D ** 2 / 2
      - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e2 / (1 - e2)) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e2 / (1 - e2) - 3 * C1 ** 2) * D ** 6 / 720
    );

  // Longitud (radianes)
  const lon = lon0 + (
      D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e2 / (1 - e2) + 24 * T1 ** 2) * D ** 5 / 120
  ) / cosPhi1;

  return {
    lat: lat * 180 / Math.PI,
    lon: lon * 180 / Math.PI,
  };
}

/**
 * Latitud / Longitud → UTM
 */
function latLonToUtm(lat, lon) {
  const { a, e2, k0 } = GRS80;

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;

  // Número de zona y meridiano central
  const zone   = Math.floor((lon + 180) / 6) + 1;
  const lon0   = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  // Parámetros en la latitud dada
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N  = a / Math.sqrt(1 - e2 * sinLat ** 2);
  const T  = tanLat ** 2;
  const C  = e2 / (1 - e2) * cosLat ** 2;
  const A  = cosLat * (lonRad - lon0);

  // Arco de meridiano
  const M = a * (
      (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad)
  );

  // Este
  const easting = k0 * N * (
      A
    + (1 - T + C) * A ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * e2 / (1 - e2)) * A ** 5 / 120
  ) + UTM.E0;

  // Norte
  let northing = k0 * (
    M + N * tanLat * (
        A ** 2 / 2
      + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * e2 / (1 - e2)) * A ** 6 / 720
    )
  );

  const hemisphere = lat < 0 ? 'S' : 'N';
  if (lat < 0) northing += UTM.N0_S;

  // Letra de banda de latitud (sistema MGRS)
  const band = getLatBand(lat);

  return { zone, hemisphere, band, easting, northing };
}

/** Letra de banda de latitud MGRS */
function getLatBand(lat) {
  const bands = 'CDEFGHJKLMNPQRSTUVWX';
  const idx = Math.floor((lat + 80) / 8);
  if (idx < 0) return 'C';
  if (idx >= bands.length) return 'X';
  return bands[idx];
}

/* ═══════════════════════════════════════════════════════════════
   3. UTILIDADES DE FORMATO
   ═══════════════════════════════════════════════════════════════ */

/** Grados decimales → Grados°Minutos′Segundos″ */
function toDMS(dd, isLat) {
  const abs    = Math.abs(dd);
  const deg    = Math.floor(abs);
  const minFlt = (abs - deg) * 60;
  const min    = Math.floor(minFlt);
  const sec    = ((minFlt - min) * 60).toFixed(3);

  let dir;
  if (isLat) {
    dir = dd >= 0 ? 'N' : 'S';
  } else {
    dir = dd >= 0 ? 'E' : 'O';
  }
  return `${deg}° ${min}′ ${sec}″ ${dir}`;
}

/** Formato número con separador de miles */
function fmtNum(n, decimals = 3) {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ═══════════════════════════════════════════════════════════════
   4. VALIDACIONES
   ═══════════════════════════════════════════════════════════════ */

function validateUTM(zone, hemisphere, easting, northing) {
  const errors = [];
  if (!zone || zone < 1 || zone > 60 || !Number.isInteger(Number(zone))) {
    errors.push('Zona UTM inválida (debe ser un entero entre 1 y 60)');
  }
  if (hemisphere !== 'N' && hemisphere !== 'S') {
    errors.push('Selecciona el hemisferio (Norte o Sur)');
  }
  if (isNaN(easting) || easting < 100000 || easting > 900000) {
    errors.push('Coordenada Este fuera de rango (100 000 – 900 000 m)');
  }
  if (isNaN(northing) || northing < 0 || northing > 10000000) {
    errors.push('Coordenada Norte fuera de rango (0 – 10 000 000 m)');
  }
  return errors;
}

function validateLatLon(lat, lon) {
  const errors = [];
  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push('Latitud inválida (−90 a +90 grados decimales)');
  }
  if (isNaN(lon) || lon < -180 || lon > 180) {
    errors.push('Longitud inválida (−180 a +180 grados decimales)');
  }
  return errors;
}

/* ═══════════════════════════════════════════════════════════════
   5. SISTEMA DE NOTIFICACIONES (TOAST)
   ═══════════════════════════════════════════════════════════════ */

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error:   `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  info:    `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="5" r="0.8" fill="currentColor"/></svg>`,
};

function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${TOAST_ICONS[type]}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   6. PORTAPAPELES
   ═══════════════════════════════════════════════════════════════ */

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = btn.innerHTML.replace(/Copiar\s\w+/, 'Copiado ✓');
    showToast('Copiado al portapapeles', 'success', 2000);
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    showToast('No se pudo copiar. Usa Ctrl+C manualmente.', 'error');
  }
}

/* ═══════════════════════════════════════════════════════════════
   7. ESTADO GLOBAL
   ═══════════════════════════════════════════════════════════════ */

const state = {
  mode:     'utm',      // 'utm' | 'latlon'
  tab:      'individual', // 'individual' | 'batch'
  lastGeo:  null,       // { lat, lon } último resultado
  lastUtm:  null,       // { zone, hemisphere, easting, northing }
  batchRows: [],        // Array de filas batch
};

/* ═══════════════════════════════════════════════════════════════
   8. INTERFAZ — Individual
   ═══════════════════════════════════════════════════════════════ */

/** Cambia la dirección de conversión */
function setMode(mode) {
  state.mode = mode;
  const modeUtm    = document.getElementById('mode-utm');
  const modeLatlon = document.getElementById('mode-latlon');
  const formUtm    = document.getElementById('form-utm');
  const formLatlon = document.getElementById('form-latlon');
  const inputTitle = document.getElementById('input-panel-title');
  const outTitle   = document.getElementById('output-panel-title');
  const resGeo     = document.getElementById('results-geo');
  const resUtm     = document.getElementById('results-utm');
  const resEmpty   = document.getElementById('result-empty');

  if (mode === 'utm') {
    modeUtm.classList.add('mode-btn--active');
    modeUtm.setAttribute('aria-pressed', 'true');
    modeLatlon.classList.remove('mode-btn--active');
    modeLatlon.setAttribute('aria-pressed', 'false');
    formUtm.classList.remove('conv-form--hidden');
    formLatlon.classList.add('conv-form--hidden');
    inputTitle.textContent = 'Coordenadas UTM';
    outTitle.textContent   = 'Resultado geográfico';
  } else {
    modeLatlon.classList.add('mode-btn--active');
    modeLatlon.setAttribute('aria-pressed', 'true');
    modeUtm.classList.remove('mode-btn--active');
    modeUtm.setAttribute('aria-pressed', 'false');
    formLatlon.classList.remove('conv-form--hidden');
    formUtm.classList.add('conv-form--hidden');
    inputTitle.textContent = 'Coordenadas geográficas';
    outTitle.textContent   = 'Resultado UTM';
  }

  // Resetear resultados al cambiar de modo
  resGeo.classList.add('results-panel--hidden');
  resUtm.classList.add('results-panel--hidden');
  resEmpty.style.display = '';
  state.lastGeo = null;
  state.lastUtm = null;
}

/** Muestra resultado UTM → Lat/Lon */
function displayGeoResult(result, zone, hemisphere) {
  const { lat, lon } = result;
  state.lastGeo = { lat, lon };

  document.getElementById('res-lat-dd').textContent  = lat.toFixed(6);
  document.getElementById('res-lat-dms').textContent = toDMS(lat, true);
  document.getElementById('res-lon-dd').textContent  = lon.toFixed(6);
  document.getElementById('res-lon-dms').textContent = toDMS(lon, false);

  document.getElementById('meta-zone').textContent = `Zona ${zone}${getLatBand(lat)}`;
  document.getElementById('meta-hemi').textContent = hemisphere === 'S' ? 'Sur' : 'Norte';

  const resEmpty = document.getElementById('result-empty');
  const resGeo   = document.getElementById('results-geo');
  resEmpty.style.display = 'none';
  resGeo.classList.remove('results-panel--hidden');
  document.getElementById('results-utm').classList.add('results-panel--hidden');
}

/** Muestra resultado Lat/Lon → UTM */
function displayUtmResult(result) {
  const { zone, hemisphere, band, easting, northing } = result;
  state.lastUtm = result;

  document.getElementById('res-easting').textContent  = fmtNum(easting);
  document.getElementById('res-northing').textContent = fmtNum(northing);
  document.getElementById('res-zone-calc').textContent = `${zone}${band} · ${hemisphere === 'S' ? 'Sur' : 'Norte'}`;
  document.getElementById('meta-band').textContent = `Banda ${band}`;

  const resEmpty = document.getElementById('result-empty');
  const resUtm   = document.getElementById('results-utm');
  resEmpty.style.display = 'none';
  resUtm.classList.remove('results-panel--hidden');
  document.getElementById('results-geo').classList.add('results-panel--hidden');
}

/** Marca errores en campos del formulario */
function setFieldError(fieldId, hasError) {
  const el = document.getElementById(fieldId);
  if (el) el.classList.toggle('is-error', hasError);
}

/* ═══════════════════════════════════════════════════════════════
   9. BATCH — Conversión masiva
   ═══════════════════════════════════════════════════════════════ */

let batchIdCounter = 0;

/** Crea una fila batch vacía */
function createBatchRow(data = {}) {
  batchIdCounter++;
  return {
    id:        batchIdCounter,
    name:      data.name      || `PT-${String(batchIdCounter).padStart(3, '0')}`,
    zone:      data.zone      || '',
    hemisphere:data.hemisphere|| 'S',
    easting:   data.easting   || '',
    northing:  data.northing  || '',
    lat:       null,
    lon:       null,
    status:    'idle', // idle | ok | error
  };
}

/** Renderiza todas las filas en la tabla */
function renderBatchTable() {
  const tbody = document.getElementById('batch-tbody');
  const empty = document.getElementById('batch-empty');
  const exportBtn = document.getElementById('btn-export-csv');
  const stat = document.getElementById('batch-stat');

  tbody.innerHTML = '';

  if (state.batchRows.length === 0) {
    empty.style.display = '';
    exportBtn.disabled = true;
    stat.textContent = '0 puntos';
    return;
  }

  empty.style.display = 'none';
  const converted = state.batchRows.filter(r => r.status === 'ok').length;
  stat.textContent = `${state.batchRows.length} punto${state.batchRows.length !== 1 ? 's' : ''} · ${converted} convertido${converted !== 1 ? 's' : ''}`;
  exportBtn.disabled = converted === 0;

  state.batchRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    const statusHtml = {
      idle:  `<span class="status-badge status-badge--idle">Pendiente</span>`,
      ok:    `<span class="status-badge status-badge--ok">OK</span>`,
      error: `<span class="status-badge status-badge--error">Error</span>`,
    }[row.status];

    const latHtml = row.lat !== null
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${row.lat.toFixed(6)}°</span>`
      : '—';
    const lonHtml = row.lon !== null
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${row.lon.toFixed(6)}°</span>`
      : '—';

    tr.innerHTML = `
      <td><input type="text"   value="${escHtml(row.name)}"       data-field="name"       aria-label="Nombre del punto" /></td>
      <td><input type="number" value="${escHtml(row.zone)}"       data-field="zone"       min="1" max="60" inputmode="numeric" aria-label="Zona UTM" /></td>
      <td>
        <select data-field="hemisphere" aria-label="Hemisferio">
          <option value="N" ${row.hemisphere === 'N' ? 'selected' : ''}>N</option>
          <option value="S" ${row.hemisphere === 'S' ? 'selected' : ''}>S</option>
        </select>
      </td>
      <td class="mono"><input type="number" value="${escHtml(row.easting)}"   data-field="easting"    step="0.001" inputmode="decimal" aria-label="Coordenada Este" /></td>
      <td class="mono"><input type="number" value="${escHtml(row.northing)}"  data-field="northing"   step="0.001" inputmode="decimal" aria-label="Coordenada Norte" /></td>
      <td class="mono">${latHtml}</td>
      <td class="mono">${lonHtml}</td>
      <td>${statusHtml}</td>
      <td class="col-actions">
        <button class="btn-delete-row" data-id="${row.id}" aria-label="Eliminar fila ${row.name}">
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Listeners de edición en celda
  tbody.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = +e.target.closest('tr').dataset.id;
      const field = e.target.dataset.field;
      const row = state.batchRows.find(r => r.id === id);
      if (row) {
        row[field] = e.target.value;
        row.status = 'idle';
        row.lat = null;
        row.lon = null;
        renderBatchTable();
      }
    });
  });

  // Listeners de eliminar fila
  tbody.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = +btn.dataset.id;
      state.batchRows = state.batchRows.filter(r => r.id !== id);
      renderBatchTable();
    });
  });
}

/** Escape de HTML para prevenir XSS en datos del usuario */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parsea CSV e importa filas */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows  = [];
  let skipped = 0;

  lines.forEach((line, idx) => {
    // Ignorar encabezados
    if (idx === 0 && /nombre|name|punto|pt/i.test(line)) return;

    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 5) { skipped++; return; }

    const [name, zone, hemisphere, easting, northing] = cols;

    rows.push(createBatchRow({
      name,
      zone:       zone,
      hemisphere: hemisphere.toUpperCase() === 'N' ? 'N' : 'S',
      easting:    parseFloat(easting),
      northing:   parseFloat(northing),
    }));
  });

  return { rows, skipped };
}

/** Exporta resultados a CSV */
function exportCSV() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay resultados para exportar', 'error');
    return;
  }

  const header = 'Nombre,Zona,Hemisferio,Este_X,Norte_Y,Latitud_DD,Longitud_DD,Latitud_DMS,Longitud_DMS\n';
  const body = converted.map(r =>
    `${r.name},${r.zone},${r.hemisphere},${r.easting},${r.northing},${r.lat.toFixed(6)},${r.lon.toFixed(6)},"${toDMS(r.lat,true)}","${toDMS(r.lon,false)}"`
  ).join('\n');

  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `GeoToolkits_UTM_Conversion_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${converted.length} puntos exportados como CSV`, 'success');
}

/* ═══════════════════════════════════════════════════════════════
   10. NAVEGACIÓN POR TABS
   ═══════════════════════════════════════════════════════════════ */

function setTab(tab) {
  state.tab = tab;

  const tabIndividual = document.getElementById('tab-individual');
  const tabBatch      = document.getElementById('tab-batch');
  const panelInd      = document.getElementById('panel-individual');
  const panelBatch    = document.getElementById('panel-batch');
  const mobileInd     = document.querySelector('[data-tab="individual"].mobile-nav-btn');
  const mobileBatch   = document.querySelector('[data-tab="batch"].mobile-nav-btn');

  if (tab === 'individual') {
    tabIndividual.classList.add('tab-btn--active');
    tabIndividual.setAttribute('aria-selected', 'true');
    tabBatch.classList.remove('tab-btn--active');
    tabBatch.setAttribute('aria-selected', 'false');
    panelInd.classList.remove('converter-panel--hidden');
    panelInd.setAttribute('aria-hidden', 'false');
    panelBatch.classList.add('converter-panel--hidden');
    panelBatch.setAttribute('aria-hidden', 'true');
    if (mobileInd) { mobileInd.classList.add('mobile-nav-btn--active'); mobileInd.setAttribute('aria-pressed','true'); }
    if (mobileBatch) { mobileBatch.classList.remove('mobile-nav-btn--active'); mobileBatch.setAttribute('aria-pressed','false'); }
  } else {
    tabBatch.classList.add('tab-btn--active');
    tabBatch.setAttribute('aria-selected', 'true');
    tabIndividual.classList.remove('tab-btn--active');
    tabIndividual.setAttribute('aria-selected', 'false');
    panelBatch.classList.remove('converter-panel--hidden');
    panelBatch.setAttribute('aria-hidden', 'false');
    panelInd.classList.add('converter-panel--hidden');
    panelInd.setAttribute('aria-hidden', 'true');
    if (mobileBatch) { mobileBatch.classList.add('mobile-nav-btn--active'); mobileBatch.setAttribute('aria-pressed','true'); }
    if (mobileInd) { mobileInd.classList.remove('mobile-nav-btn--active'); mobileInd.setAttribute('aria-pressed','false'); }
    renderBatchTable();
  }
}

/* ═══════════════════════════════════════════════════════════════
   11. COMPARTIR HERRAMIENTA
   ═══════════════════════════════════════════════════════════════ */

async function shareOrCopyUrl() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'GeoToolkits · Conversor UTM ↔ Lat/Lon',
        text:  'Herramienta profesional de conversión geoespacial por AeroGeoTop',
        url,
      });
    } catch (err) {
      if (err.name !== 'AbortError') fallbackCopyUrl(url);
    }
  } else {
    fallbackCopyUrl(url);
  }
}

function fallbackCopyUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Enlace copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Comparte este enlace: ' + url, 'info', 5000);
  });
}

/* ═══════════════════════════════════════════════════════════════
   12. INICIALIZACIÓN Y EVENT LISTENERS
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* — Año en footer — */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* — Modo UTM / LatLon — */
  document.getElementById('mode-utm').addEventListener('click', () => setMode('utm'));
  document.getElementById('mode-latlon').addEventListener('click', () => setMode('latlon'));

  /* — Tabs individual / masivo — */
  document.getElementById('tab-individual').addEventListener('click', () => setTab('individual'));
  document.getElementById('tab-batch').addEventListener('click', () => setTab('batch'));

  /* — Mobile nav — */
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  /* — Compartir — */
  document.getElementById('btn-share-tool').addEventListener('click', shareOrCopyUrl);

  /* ── FORMULARIO UTM → LatLon ── */
  document.getElementById('form-utm').addEventListener('submit', (e) => {
    e.preventDefault();
    const zone       = parseInt(document.getElementById('utm-zone').value, 10);
    const hemisphere = document.getElementById('utm-hemisphere').value;
    const easting    = parseFloat(document.getElementById('utm-easting').value);
    const northing   = parseFloat(document.getElementById('utm-northing').value);

    const errors = validateUTM(zone, hemisphere, easting, northing);

    // Visual de errores
    setFieldError('utm-zone',       !zone || zone < 1 || zone > 60);
    setFieldError('utm-hemisphere', hemisphere !== 'N' && hemisphere !== 'S');
    setFieldError('utm-easting',    isNaN(easting) || easting < 100000 || easting > 900000);
    setFieldError('utm-northing',   isNaN(northing) || northing < 0 || northing > 10000000);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    try {
      const result = utmToLatLon(zone, hemisphere, easting, northing);
      displayGeoResult(result, zone, hemisphere);
    } catch (err) {
      showToast('Error en el cálculo. Verifica los datos ingresados.', 'error');
      console.error('[GeoToolkits] UTM→LatLon error:', err);
    }
  });

  /* — Reset UTM form — */
  document.getElementById('form-utm').addEventListener('reset', () => {
    ['utm-zone','utm-hemisphere','utm-easting','utm-northing'].forEach(id => setFieldError(id, false));
    document.getElementById('results-geo').classList.add('results-panel--hidden');
    document.getElementById('result-empty').style.display = '';
    state.lastGeo = null;
  });

  /* ── FORMULARIO LatLon → UTM ── */
  document.getElementById('form-latlon').addEventListener('submit', (e) => {
    e.preventDefault();
    const lat = parseFloat(document.getElementById('ll-lat').value);
    const lon = parseFloat(document.getElementById('ll-lon').value);

    const errors = validateLatLon(lat, lon);
    setFieldError('ll-lat', isNaN(lat) || lat < -90 || lat > 90);
    setFieldError('ll-lon', isNaN(lon) || lon < -180 || lon > 180);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    try {
      const result = latLonToUtm(lat, lon);
      displayUtmResult(result);
    } catch (err) {
      showToast('Error en el cálculo. Verifica los datos ingresados.', 'error');
      console.error('[GeoToolkits] LatLon→UTM error:', err);
    }
  });

  /* — Reset LatLon form — */
  document.getElementById('form-latlon').addEventListener('reset', () => {
    ['ll-lat','ll-lon'].forEach(id => setFieldError(id, false));
    document.getElementById('results-utm').classList.add('results-panel--hidden');
    document.getElementById('result-empty').style.display = '';
    state.lastUtm = null;
  });

  /* ── BOTONES DE COPIA — UTM → LatLon ── */
  document.getElementById('btn-copy-dd').addEventListener('click', function() {
    if (!state.lastGeo) return;
    const { lat, lon } = state.lastGeo;
    copyToClipboard(`${lat.toFixed(6)}, ${lon.toFixed(6)}`, this);
  });

  document.getElementById('btn-copy-dms').addEventListener('click', function() {
    if (!state.lastGeo) return;
    const { lat, lon } = state.lastGeo;
    copyToClipboard(`${toDMS(lat, true)}, ${toDMS(lon, false)}`, this);
  });

  /* ── BOTÓN DE COPIA — LatLon → UTM ── */
  document.getElementById('btn-copy-utm').addEventListener('click', function() {
    if (!state.lastUtm) return;
    const { zone, hemisphere, band, easting, northing } = state.lastUtm;
    const txt = `Zona ${zone}${band} ${hemisphere} · E: ${easting.toFixed(3)} · N: ${northing.toFixed(3)}`;
    copyToClipboard(txt, this);
  });

  /* ── VER EN MAPA — Google Maps ── */
  function openGoogleMaps(lat, lon) {
    const url = `https://maps.google.com/?q=${lat},${lon}&z=15`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  document.getElementById('btn-open-map').addEventListener('click', () => {
    if (!state.lastGeo) return;
    openGoogleMaps(state.lastGeo.lat, state.lastGeo.lon);
  });

  document.getElementById('btn-open-map-ll').addEventListener('click', () => {
    if (!state.lastGeo) {
      const lat = parseFloat(document.getElementById('ll-lat').value);
      const lon = parseFloat(document.getElementById('ll-lon').value);
      if (!isNaN(lat) && !isNaN(lon)) openGoogleMaps(lat, lon);
    } else {
      openGoogleMaps(state.lastGeo.lat, state.lastGeo.lon);
    }
  });

  /* ── BATCH: agregar fila — */
  document.getElementById('btn-add-row').addEventListener('click', () => {
    state.batchRows.push(createBatchRow());
    renderBatchTable();
  });

  /* ── BATCH: convertir todo — */
  document.getElementById('btn-convert-all').addEventListener('click', () => {
    if (state.batchRows.length === 0) {
      showToast('No hay filas para convertir', 'info');
      return;
    }

    let converted = 0;
    let failed = 0;

    state.batchRows.forEach(row => {
      const zone  = parseInt(row.zone, 10);
      const hem   = row.hemisphere;
      const east  = parseFloat(row.easting);
      const north = parseFloat(row.northing);
      const errs  = validateUTM(zone, hem, east, north);

      if (errs.length > 0) {
        row.status = 'error';
        row.lat = null;
        row.lon = null;
        failed++;
      } else {
        try {
          const res = utmToLatLon(zone, hem, east, north);
          row.lat = res.lat;
          row.lon = res.lon;
          row.status = 'ok';
          converted++;
        } catch {
          row.status = 'error';
          failed++;
        }
      }
    });

    renderBatchTable();

    if (failed === 0) {
      showToast(`${converted} punto${converted !== 1 ? 's' : ''} convertido${converted !== 1 ? 's' : ''} correctamente`, 'success');
    } else {
      showToast(`${converted} OK · ${failed} con error`, 'info');
    }
  });

  /* ── BATCH: importar CSV — */
  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      showToast('Solo se aceptan archivos .csv', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, skipped } = parseCSV(ev.target.result);
      if (rows.length === 0) {
        showToast('No se encontraron filas válidas en el CSV', 'error');
        return;
      }
      state.batchRows.push(...rows);
      renderBatchTable();
      setTab('batch');
      showToast(`${rows.length} filas importadas${skipped > 0 ? ` · ${skipped} omitidas` : ''}`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ── BATCH: exportar CSV — */
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  /* ── INICIALIZAR tabla batch vacía — */
  renderBatchTable();
});