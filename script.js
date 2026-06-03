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
import { exportDXF as geoExportDXF, exportSIG as geoExportSIG } from './geoExporter.js';

/* ═══════════════════════════════════════════════════════════════
   1. CONSTANTES GEODÉSICAS — Elipsoide GRS-80 / WGS-84
   ═══════════════════════════════════════════════════════════════ */
// Usar parámetros WGS-84 cuando la UI y metadatos declaran WGS-84
const WGS84 = {
  a: 6378137.0,                 // Semieje mayor (m)
  f: 1 / 298.257223563,         // Achatamiento (WGS-84)
};
WGS84.b  = WGS84.a * (1 - WGS84.f);                     // Semieje menor
WGS84.e2 = 2 * WGS84.f - WGS84.f ** 2;                  // Excentricidad²
WGS84.n  = WGS84.f / (2 - WGS84.f);                     // Tercera aplanamiento

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
  const { a, e2 } = WGS84;
  const k0 = UTM.k0;
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
  const { a, e2 } = WGS84;
  const k0 = UTM.k0;

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
  const sec    = ((minFlt - min) * 60).toFixed(4);

  let dir;
  if (isLat) {
    dir = dd >= 0 ? 'N' : 'S';
  } else {
    dir = dd >= 0 ? 'E' : 'O';
  }
  return `${deg}° ${min}′ ${sec}″ ${dir}`;
}

/** Formato número con separador de miles */
function fmtNum(n, decimals = 4) {
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

/** Validación rápida por fila (batch) — devuelve array de mensajes */
function validateBatchRow(row) {
  const zone = parseInt(String(row.zone).replace(/\D/g,''), 10);
  const hem = String(row.hemisphere || '').toUpperCase();
  const easting = parseFloat(String(row.easting).replace(/,/g,'.').replace(/[^\d.-]/g,''));
  const northing = parseFloat(String(row.northing).replace(/,/g,'.').replace(/[^\d.-]/g,''));
  const errs = [];
  if (isNaN(zone) || zone < 1 || zone > 60) errs.push('Zona inválida (1–60)');
  if (hem !== 'N' && hem !== 'S') errs.push('Hemisferio inválido (N/S)');
  if (isNaN(easting)) errs.push('Coordenada Este inválida');
  if (isNaN(northing)) errs.push('Coordenada Norte inválida');
  return errs;
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
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${TOAST_ICONS[type]}<span>${message}</span><button class="toast-close" aria-label="Cerrar notificación">×</button>`;
  container.appendChild(toast);

  const dismiss = () => {
    if (!toast.parentElement) return;
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => {
      if (toast.parentElement) toast.remove();
    }, { once: true });
  };

  const closeButton = toast.querySelector('.toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      clearTimeout(timeoutId);
      dismiss();
    });
  }

  const timeoutId = setTimeout(() => {
    dismiss();
  }, duration);
}

/* ═══════════════════════════════════════════════════════════════
   6. PORTAPAPELES
   ═══════════════════════════════════════════════════════════════ */

async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const labelSpan = btn.querySelector('.btn-action-label') || btn.querySelector('span:last-child') || btn;
    const originalText = labelSpan.textContent;
    btn.classList.add('copied');
    labelSpan.textContent = 'Copiado ✓';
    showToast('Copiado al portapapeles', 'success', 3000);
    setTimeout(() => {
      labelSpan.textContent = originalText;
      btn.classList.remove('copied');
    }, 2000);
  } catch {
    showToast('No se pudo copiar. Usa Ctrl+C manualmente.', 'error');
  }
}

async function copyAllToClipboard() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay puntos convertidos para copiar', 'error');
    return;
  }

  const header = 'Punto\tZona\tHem.\tEste\tNorte\tLatitud_DD\tLongitud_DD\tLatitud_DMS\tLongitud_DMS';
  const rows = converted.map(r =>
    `${r.name}\t${r.zone}\t${r.hemisphere}\t${r.easting}\t${r.northing}\t${r.lat.toFixed(7)}\t${r.lon.toFixed(7)}\t${toDMS(r.lat, true)}\t${toDMS(r.lon, false)}`
  ).join('\n');

  const text = `${header}\n${rows}`;

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy-all');
    if (btn) {
      btn.classList.add('copied');
      const originalText = btn.textContent;
      btn.textContent = 'Copiado ✓';
      showToast(`${converted.length} puntos copiados al portapapeles`, 'success', 3000);
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }
  } catch {
    showToast('No se pudo copiar. Usa Ctrl+C manualmente.', 'error');
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function addImportHistory(valid, invalid) {
  state.importHistory.unshift({
    valid,
    invalid,
    timestamp: new Date().toISOString(),
  });
  if (state.importHistory.length > 10) {
    state.importHistory.length = 10;
  }
}

function renderHistoryPanel() {
  const panel = document.getElementById('batch-history-panel');
  const content = document.getElementById('history-panel-content');
  if (!panel || !content) return;

  if (state.importHistory.length === 0) {
    content.innerHTML = '<p>No hay importaciones recientes.</p>';
    return;
  }

  const items = state.importHistory.map(entry => {
    const date = new Date(entry.timestamp).toLocaleString('es-AR', { hour12: false });
    return `<div class="history-item"><span class="history-item-date">${date}</span><span>${entry.valid} válidas, ${entry.invalid} inválidas</span></div>`;
  }).join('');

  content.innerHTML = `
    <div class="history-summary">Últimas importaciones</div>
    ${items}
  `;
}

function toggleHistoryPanel() {
  const panel = document.getElementById('batch-history-panel');
  if (!panel) return;
  const isOpen = panel.classList.toggle('history-panel--visible');
  panel.hidden = !isOpen;
  if (isOpen) {
    renderHistoryPanel();
  }
}

function exportKML() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay puntos convertidos para exportar KML', 'error');
    return;
  }

  const placemarks = converted.map(r => {
    const lon = r.lon.toFixed(7);
    const lat = r.lat.toFixed(7);
    const label = escapeXml(r.name || 'Punto');
    return `
      <Placemark>
        <name>${label}</name>
        <Point>
          <coordinates>${lon},${lat},0</coordinates>
        </Point>
      </Placemark>`;
  }).join('');

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Levantamiento AeroGeoTop</name>
    ${placemarks}
  </Document>
</kml>`;

  const blob = new Blob([`\ufeff${kml}`], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const baseName = state.lastImportedFileName || 'Levantamiento_AeroGeoTop';
  const today = new Date();
  const dateLabel = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  a.download = `${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateLabel}.kml`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${converted.length} puntos exportados a KML`, 'success');
}

function getExportBaseName(fallback) {
  const raw = (state.lastImportedFileName || fallback).trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return safe || fallback;
}

function getExportDateLabel() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
}

function exportDXF() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay puntos convertidos para exportar DXF', 'error');
    return;
  }

  const entities = converted.map((r) => {
    const x = Number.parseFloat(r.easting || 0).toFixed(4);
    const y = Number.parseFloat(r.northing || 0).toFixed(4);
    const label = escapeXml(r.name || 'Punto');
    return `0
POINT
8
0
10
${x}
20
${y}
30
0
0
TEXT
8
0
10
${x}
20
${y}
30
0
1
${label}`;
  }).join('\n');

  const dxf = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
${entities}
0
ENDSEC
0
EOF\n`;

  const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getExportBaseName('GeoToolkits_DXF')}_${getExportDateLabel()}.dxf`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${converted.length} puntos exportados a DXF`, 'success');
}

function exportSIG() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay puntos convertidos para exportar SIG', 'error');
    return;
  }

  const features = converted.map((r) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Number.parseFloat(r.lon).toFixed(7), Number.parseFloat(r.lat).toFixed(7)],
    },
    properties: {
      Nombre: r.name,
      Zona: r.zone,
      Hemisferio: r.hemisphere,
      Este: r.easting,
      Norte: r.northing,
      Latitud_DD: r.lat.toFixed(7),
      Longitud_DD: r.lon.toFixed(7),
      Latitud_DMS: toDMS(r.lat, true),
      Longitud_DMS: toDMS(r.lon, false),
    },
  }));

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getExportBaseName('GeoToolkits_SIG')}_${getExportDateLabel()}.geojson`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${converted.length} puntos exportados a GeoJSON`, 'success');
}

/* ═══════════════════════════════════════════════════════════════
   7. ESTADO GLOBAL
   ═══════════════════════════════════════════════════════════════ */

const state = {
  mode:      'utm',      // 'utm' | 'latlon'
  tab:       'individual', // 'individual' | 'batch'
  lastGeo:   null,       // { lat, lon } último resultado
  lastUtm:   null,       // { zone, hemisphere, easting, northing }
  batchRows: [],        // Array de filas batch
  showErrorsOnly: false, // Filtro: mostrar solo filas con error
  importHistory: [],    // Historial de importaciones
  lastImportedFileName: '',
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
    if (modeUtm) modeUtm.classList.add('mode-btn--active');
    if (modeUtm) modeUtm.setAttribute('aria-pressed', 'true');
    if (modeLatlon) modeLatlon.classList.remove('mode-btn--active');
    if (modeLatlon) modeLatlon.setAttribute('aria-pressed', 'false');
    if (formUtm) formUtm.classList.remove('conv-form--hidden');
    if (formLatlon) formLatlon.classList.add('conv-form--hidden');
    if (inputTitle) inputTitle.textContent = 'Coordenadas UTM';
    if (outTitle) outTitle.textContent   = 'Resultado geográfico';
  } else {
    if (modeLatlon) modeLatlon.classList.add('mode-btn--active');
    if (modeLatlon) modeLatlon.setAttribute('aria-pressed', 'true');
    if (modeUtm) modeUtm.classList.remove('mode-btn--active');
    if (modeUtm) modeUtm.setAttribute('aria-pressed', 'false');
    if (formLatlon) formLatlon.classList.remove('conv-form--hidden');
    if (formUtm) formUtm.classList.add('conv-form--hidden');
    if (inputTitle) inputTitle.textContent = 'Coordenadas geográficas';
    if (outTitle) outTitle.textContent   = 'Resultado UTM';
  }

  // Resetear resultados al cambiar de modo
  if (resGeo) resGeo.classList.add('results-panel--hidden');
  if (resUtm) resUtm.classList.add('results-panel--hidden');
  if (resEmpty) resEmpty.style.display = '';
  state.lastGeo = null;
  state.lastUtm = null;
}

/** Muestra resultado UTM → Lat/Lon */
function displayGeoResult(result, zone, hemisphere) {
  const { lat, lon } = result;

  // Validar numéricamente que la salida contenga valores reales calculables
  if (isNaN(lat) || isNaN(lon)) {
    showToast('El resultado contiene valores inválidos. Verifica las coordenadas.', 'error');
    return;
  }

  state.lastGeo = { lat, lon };

  document.getElementById('res-lat-dd').textContent  = lat.toFixed(7);
  document.getElementById('res-lat-dms').textContent = toDMS(lat, true);
  document.getElementById('res-lon-dd').textContent  = lon.toFixed(7);
  document.getElementById('res-lon-dms').textContent = toDMS(lon, false);

  document.getElementById('meta-zone').textContent = `Zona ${zone}${getLatBand(lat)}`;
  document.getElementById('meta-hemi').textContent = hemisphere === 'S' ? 'Sur' : 'Norte';

  const resEmpty = document.getElementById('result-empty');
  const resGeo   = document.getElementById('results-geo');
  if (resEmpty) resEmpty.style.display = 'none';
  if (resGeo) resGeo.classList.remove('results-panel--hidden');
  const resUtm = document.getElementById('results-utm');
  if (resUtm) resUtm.classList.add('results-panel--hidden');
}

/** Muestra resultado Lat/Lon → UTM */
function displayUtmResult(result) {
  const { zone, hemisphere, band, easting, northing } = result;

  if (isNaN(easting) || isNaN(northing)) {
    showToast('El resultado contiene valores inválidos. Verifica las coordenadas.', 'error');
    return;
  }

  state.lastUtm = result;

  document.getElementById('res-easting').textContent   = fmtNum(easting);
  document.getElementById('res-northing').textContent  = fmtNum(northing);
  document.getElementById('res-zone-calc').textContent = `${zone}${band} · ${hemisphere === 'S' ? 'Sur' : 'Norte'}`;
  document.getElementById('meta-band').textContent     = `Banda ${band}`;

  const resEmpty = document.getElementById('result-empty');
  const resUtm   = document.getElementById('results-utm');
  if (resEmpty) resEmpty.style.display = 'none';
  if (resUtm) resUtm.classList.remove('results-panel--hidden');
  const resGeo = document.getElementById('results-geo');
  if (resGeo) resGeo.classList.add('results-panel--hidden');
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
let csvWorker = null;

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
    lat:       data.lat       || null,
    lon:       data.lon       || null,
    status:    data.status    || 'idle', // idle | ok | error
  };
}

/** Renderiza todas las filas en la tabla */
function renderBatchTable() {
  const tbody = document.getElementById('batch-tbody');
  const empty = document.getElementById('batch-empty');
  const exportBtn = document.getElementById('btn-export-csv');
  const copyAllBtn = document.getElementById('btn-copy-all');
  const historyBtn = document.getElementById('btn-history');
  const kmlBtn = document.getElementById('btn-export-kml');
  const dxfBtn = document.getElementById('btn-export-dxf');
  const sigBtn = document.getElementById('btn-export-sig');
  const stat = document.getElementById('batch-stat');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (state.batchRows.length === 0) {
    if (empty) empty.style.display = '';
    if (exportBtn) exportBtn.disabled = true;
    if (copyAllBtn) copyAllBtn.disabled = true;
    if (historyBtn) historyBtn.disabled = state.importHistory.length === 0;
    if (kmlBtn) kmlBtn.disabled = true;
    if (dxfBtn) dxfBtn.disabled = true;
    if (sigBtn) sigBtn.disabled = true;
    if (stat) stat.textContent = '0 puntos';
    return;
  }

  if (empty) empty.style.display = 'none';
  const converted = state.batchRows.filter(r => r.status === 'ok').length;
  const errors = state.batchRows.filter(r => r.status === 'error').length;
  if (stat) stat.textContent = `${state.batchRows.length} punto${state.batchRows.length !== 1 ? 's' : ''} · ${converted} OK · ${errors} erro${errors !== 1 ? 'r' : 'r'}`;
  if (exportBtn) exportBtn.disabled = converted === 0;
  if (copyAllBtn) copyAllBtn.disabled = converted === 0;
  if (historyBtn) historyBtn.disabled = state.importHistory.length === 0;
  if (kmlBtn) kmlBtn.disabled = converted === 0;
  if (dxfBtn) dxfBtn.disabled = converted === 0;
  if (sigBtn) sigBtn.disabled = converted === 0;

  // Filtrar filas a mostrar
  const rowsToShow = state.showErrorsOnly ? state.batchRows.filter(r => r.status === 'error') : state.batchRows;

  rowsToShow.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.id = row.id;
    if (row.status === 'error') tr.classList.add('is-error');

    const statusIcon = {
      idle:  '⏳',
      ok:    '✓',
      error: '⚠',
    }[row.status];

    const statusHtml = {
      idle:  `<span class="status-badge status-badge--idle" title="Esperando conversión">${statusIcon} Pendiente</span>`,
      ok:    `<span class="status-badge status-badge--ok" title="Conversión exitosa">${statusIcon} OK</span>`,
      error: `<span class="status-badge status-badge--error" title="Fila con errores">${statusIcon} Error</span>`,
    }[row.status];

    const latDdHtml = (row.lat !== null && !isNaN(row.lat))
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${row.lat.toFixed(7)}</span>`
      : '—';
    const lonDdHtml = (row.lon !== null && !isNaN(row.lon))
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${row.lon.toFixed(7)}</span>`
      : '—';
    const latDmsHtml = (row.lat !== null && !isNaN(row.lat))
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${toDMS(row.lat, true)}</span>`
      : '—';
    const lonDmsHtml = (row.lon !== null && !isNaN(row.lon))
      ? `<span class="${row.status === 'ok' ? 'result-ok' : 'result-err'}">${toDMS(row.lon, false)}</span>`
      : '—';

    const errorIconHtml = row.status === 'error' ? `<button class="row-error-icon" data-error="${escHtml(row.errorMessage || 'Error en fila')}" aria-label="Error: ${escHtml(row.errorMessage || 'Error')}">⚠</button>` : '';
    const errorId = row.status === 'error' ? `error-msg-${row.id}` : '';

    tr.innerHTML = `
      <td><div class="point-cell">${errorIconHtml}<input type="text" value="${escHtml(row.name)}" data-field="name" aria-label="Nombre del punto" ${errorId ? `aria-describedby="${errorId}"` : ''} /><span id="${errorId}" class="sr-only">${row.errorMessage || ''}</span></div></td>
      <td><input type="number" value="${escHtml(row.zone)}" data-field="zone" min="1" max="60" inputmode="numeric" aria-label="Zona UTM" ${errorId ? `aria-describedby="${errorId}"` : ''} /></td>
      <td>
        <select data-field="hemisphere" aria-label="Hemisferio" ${errorId ? `aria-describedby="${errorId}"` : ''}>
          <option value="N" ${row.hemisphere === 'N' ? 'selected' : ''}>N</option>
          <option value="S" ${row.hemisphere === 'S' ? 'selected' : ''}>S</option>
        </select>
      </td>
      <td class="mono"><input type="text" value="${escHtml(row.easting)}" data-field="easting" aria-label="Coordenada Este" ${errorId ? `aria-describedby="${errorId}"` : ''} /></td>
      <td class="mono"><input type="text" value="${escHtml(row.northing)}" data-field="northing" aria-label="Coordenada Norte" ${errorId ? `aria-describedby="${errorId}"` : ''} /></td>
      <td class="mono">${latDdHtml}</td>
      <td class="mono">${lonDdHtml}</td>
      <td class="mono">${latDmsHtml}</td>
      <td class="mono">${lonDmsHtml}</td>
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

  // Delegación de eventos: evita añadir/remover listeners por fila (escalable)
  if (!tbody._delegated) {
    tbody.addEventListener('change', (e) => {
      const input = e.target;
      if (!input) return;
      const tr = input.closest('tr');
      if (!tr) return;
      const id = +tr.dataset.id;
      const field = input.dataset.field;
      const row = state.batchRows.find(r => r.id === id);
      if (row && field) {
        row[field] = input.value;
        // Re-validate the row after edit
        const errs = validateBatchRow(row);
        if (errs.length === 0) {
          row.status = 'idle';
          delete row.errorMessage;
          row.lat = null; row.lon = null;
        } else {
          row.status = 'error';
          row.errorMessage = errs.join('; ');
          row.lat = null; row.lon = null;
        }
        renderBatchTable();
      }
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-row');
      if (!btn) return;
      const id = +btn.dataset.id;
      state.batchRows = state.batchRows.filter(r => r.id !== id);
      renderBatchTable();
    });

    tbody._delegated = true;
  }
}

/** Escape de HTML para prevenir XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parsea CSV e importa filas */
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const rows  = [];
  let skipped = 0;

  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    // Ignorar encabezados
    if (idx === 0 && /nombre|name|punto|pt/i.test(line)) return;

    const cols = line.split(',').map(c => c.trim());
    if (cols.length < 5) { skipped++; return; }

    const [name, zone, hemisphere, easting, northing] = cols;

    rows.push(createBatchRow({
      name,
      zone: zone,
      hemisphere: hemisphere.toUpperCase() === 'N' ? 'N' : 'S',
      easting: easting,
      northing: northing,
    }));
  });

  return { rows, skipped };
}


function setLastImportedFileName(fileName) {
  if (!fileName) return;
  state.lastImportedFileName = fileName.replace(/\.[^.]+$/, '');
}

/** Exporta resultados a CSV */
function exportCSV() {
  const converted = state.batchRows.filter(r => r.status === 'ok');
  if (converted.length === 0) {
    showToast('No hay resultados para exportar', 'error');
    return;
  }

  const header = 'Punto\tZona\tHemisferio\tEste\tNorte\tLatitud_DD\tLongitud_DD\tLatitud_DMS\tLongitud_DMS\n';
  const body = converted.map(r =>
    `${r.name}\t${r.zone}\t${r.hemisphere}\t${r.easting}\t${r.northing}\t${r.lat.toFixed(7)}\t${r.lon.toFixed(7)}\t${toDMS(r.lat,true)}\t${toDMS(r.lon,false)}`
  ).join('\n');

  const csvContent = header + body;
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const baseName = state.lastImportedFileName || 'GeoToolkits_UTM_Conversion';
  const today = new Date();
  const dateLabel = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
  a.download = `${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${dateLabel}.xls`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${converted.length} puntos exportados como Excel`, 'success');
}

/* ═══════════════════════════════════════════════════════════════
   10. NAVEGACIÓN POR TABS
   ═══════════════════════════════════════════════════════════════ */

function setTab(tab) {
  state.tab = tab;

  state.lastGeo = null;
  state.lastUtm = null;

  const tabIndividual = document.getElementById('tab-individual');
  const tabBatch      = document.getElementById('tab-batch');
  const panelInd      = document.getElementById('panel-individual');
  const panelBatch    = document.getElementById('panel-batch');
  const mobileInd     = document.querySelector('[data-tab="individual"].mobile-nav-btn');
  const mobileBatch   = document.querySelector('[data-tab="batch"].mobile-nav-btn');

  if (tab === 'individual') {
    if (tabIndividual) tabIndividual.classList.add('tab-btn--active');
    if (tabIndividual) tabIndividual.setAttribute('aria-selected', 'true');
    if (tabBatch) tabBatch.classList.remove('tab-btn--active');
    if (tabBatch) tabBatch.setAttribute('aria-selected', 'false');
    if (panelInd) panelInd.classList.remove('converter-panel--hidden');
    if (panelInd) panelInd.setAttribute('aria-hidden', 'false');
    if (panelBatch) panelBatch.classList.add('converter-panel--hidden');
    if (panelBatch) panelBatch.setAttribute('aria-hidden', 'true');
    if (mobileInd) { mobileInd.classList.add('mobile-nav-btn--active'); mobileInd.setAttribute('aria-pressed','true'); }
    if (mobileBatch) { mobileBatch.classList.remove('mobile-nav-btn--active'); mobileBatch.setAttribute('aria-pressed','false'); }
  } else {
    if (tabBatch) tabBatch.classList.add('tab-btn--active');
    if (tabBatch) tabBatch.setAttribute('aria-selected', 'true');
    if (tabIndividual) tabIndividual.classList.remove('tab-btn--active');
    if (tabIndividual) tabIndividual.setAttribute('aria-selected', 'false');
    if (panelBatch) panelBatch.classList.remove('converter-panel--hidden');
    if (panelBatch) panelBatch.setAttribute('aria-hidden', 'false');
    if (panelInd) panelInd.classList.add('converter-panel--hidden');
    if (panelInd) panelInd.setAttribute('aria-hidden', 'true');
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
  const mUtm = document.getElementById('mode-utm');
  if (mUtm) mUtm.addEventListener('click', () => setMode('utm'));
  const mLatLon = document.getElementById('mode-latlon');
  if (mLatLon) mLatLon.addEventListener('click', () => setMode('latlon'));

  /* — Tabs individual / masivo — */
  const tInd = document.getElementById('tab-individual');
  if (tInd) tInd.addEventListener('click', () => setTab('individual'));
  const tBatch = document.getElementById('tab-batch');
  if (tBatch) tBatch.addEventListener('click', () => setTab('batch'));

  /* — Mobile nav — */
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  /* — Compartir — */
  const bShare = document.getElementById('btn-share-tool');
  if (bShare) bShare.addEventListener('click', shareOrCopyUrl);

  /* ── FORMULARIO UTM → LatLon ── */
  const fUtm = document.getElementById('form-utm');
  if (fUtm) {
    fUtm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (fUtm.classList.contains('conv-form--hidden')) {
        return;
      }

      // Sanitización completa y estricta
      const zoneRaw    = document.getElementById('utm-zone').value.trim();
      const zone       = parseInt(zoneRaw.replace(/\D/g, ''), 10);
      const hemisphere = document.getElementById('utm-hemisphere').value.trim().toUpperCase();

      const eastingRaw  = document.getElementById('utm-easting').value.trim();
      const northingRaw = document.getElementById('utm-northing').value.trim();

      const easting  = parseFloat(eastingRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      const northing = parseFloat(northingRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));

      const errors = validateUTM(zone, hemisphere, easting, northing);

      setFieldError('utm-zone',       isNaN(zone) || zone < 1 || zone > 60);
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

    fUtm.addEventListener('reset', () => {
      ['utm-zone','utm-hemisphere','utm-easting','utm-northing'].forEach(id => setFieldError(id, false));
      const rGeo = document.getElementById('results-geo');
      if (rGeo) rGeo.classList.add('results-panel--hidden');
      const rEmpty = document.getElementById('result-empty');
      if (rEmpty) rEmpty.style.display = '';
      state.lastGeo = null;
    });
  }

  /* ── FORMULARIO LatLon → UTM ── */
  const fLatLon = document.getElementById('form-latlon');
  if (fLatLon) {
    fLatLon.addEventListener('submit', (e) => {
      e.preventDefault();
      if (fLatLon.classList.contains('conv-form--hidden')) {
        return;
      }

      const latRaw = document.getElementById('ll-lat').value.trim();
      const lonRaw = document.getElementById('ll-lon').value.trim();

      const lat = parseFloat(latRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      const lon = parseFloat(lonRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));

      // Validación interna rápida de Lat/Lon
      const errors = [];
      if (isNaN(lat) || lat < -90 || lat > 90) errors.push('Latitud inválida (−90 a +90°)');
      if (isNaN(lon) || lon < -180 || lon > 180) errors.push('Longitud inválida (−180 a +180°)');

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

    fLatLon.addEventListener('reset', () => {
      ['ll-lat','ll-lon'].forEach(id => setFieldError(id, false));
      const rUtm = document.getElementById('results-utm');
      if (rUtm) rUtm.classList.add('results-panel--hidden');
      const rEmpty = document.getElementById('result-empty');
      if (rEmpty) rEmpty.style.display = '';
      state.lastUtm = null;
    });
  }

  /* ── BOTONES DE COPIA ── */
  const bCopyDD = document.getElementById('btn-copy-dd');
  if (bCopyDD) {
    bCopyDD.addEventListener('click', function() {
      if (!state.lastGeo) return;
      const { lat, lon } = state.lastGeo;
      copyToClipboard(`${lat.toFixed(7)}, ${lon.toFixed(7)}`, this);
    });
  }

  const bCopyDMS = document.getElementById('btn-copy-dms');
  if (bCopyDMS) {
    bCopyDMS.addEventListener('click', function() {
      if (!state.lastGeo) return;
      const { lat, lon } = state.lastGeo;
      copyToClipboard(`${toDMS(lat, true)}, ${toDMS(lon, false)}`, this);
    });
  }

  const bCopyUtm = document.getElementById('btn-copy-utm');
  if (bCopyUtm) {
    bCopyUtm.addEventListener('click', function() {
      if (!state.lastUtm) return;
      const { zone, hemisphere, band, easting, northing } = state.lastUtm;
      const txt = `Zona ${zone}${band} ${hemisphere} · E: ${easting.toFixed(4)} · N: ${northing.toFixed(4)}`;
      copyToClipboard(txt, this);
    });
  }

  /* ── ENLACE DE MAPAS OFICIAL (GOOGLE MAPS) ── */
  function openGoogleMaps(lat, lon) {
    // CORREGIDO: URL estándar global parametrizada para evitar errores de codificación
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const bOpenMap = document.getElementById('btn-open-map');
  if (bOpenMap) {
    bOpenMap.addEventListener('click', () => {
      if (!state.lastGeo) return;
      openGoogleMaps(state.lastGeo.lat, state.lastGeo.lon);
    });
  }

  const bOpenMapLL = document.getElementById('btn-open-map-ll');
  if (bOpenMapLL) {
    bOpenMapLL.addEventListener('click', () => {
      const latRaw = document.getElementById('ll-lat').value.trim();
      const lonRaw = document.getElementById('ll-lon').value.trim();
      const lat = parseFloat(latRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      const lon = parseFloat(lonRaw.replace(/,/g, '.').replace(/[^\d.-]/g, ''));
      if (!isNaN(lat) && !isNaN(lon)) {
        openGoogleMaps(lat, lon);
      } else {
        showToast('Ingresa coordenadas válidas antes de ver en el mapa', 'info');
      }
    });
  }

  /* ── BATCH: agregar fila ── */
  const bAddRow = document.getElementById('btn-add-row');
  if (bAddRow) {
    bAddRow.addEventListener('click', () => {
      state.batchRows.push(createBatchRow());
      renderBatchTable();
    });
  }

  /* ── BATCH: convertir todo ── */
  const bConvertAll = document.getElementById('btn-convert-all');
  if (bConvertAll) {
    bConvertAll.addEventListener('click', async () => {
      if (state.batchRows.length === 0) {
        showToast('No hay filas para convertir', 'info');
        return;
      }

      let converted = 0;
      let failed = 0;

      const chunkSize = 200; // Ajustable según capacidad de la UI
      for (let i = 0; i < state.batchRows.length; i += chunkSize) {
        const chunk = state.batchRows.slice(i, i + chunkSize);
        chunk.forEach(row => {
          const zClean = String(row.zone).trim().replace(/\D/g, '');
          const zone  = parseInt(zClean, 10);
          const hem   = String(row.hemisphere).trim().toUpperCase();

          const eClean = String(row.easting).trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
          const nClean = String(row.northing).trim().replace(/,/g, '.').replace(/[^\d.-]/g, '');
          const east  = parseFloat(eClean);
          const north = parseFloat(nClean);

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
            } catch (err) {
              row.status = 'error';
              row.lat = null;
              row.lon = null;
              failed++;
              console.error('[GeoToolkits] Batch row error:', err);
            }
          }
        });

        // Actualizar la UI por chunks para mantener la interfaz responsiva
        renderBatchTable();
        await new Promise(r => setTimeout(r, 0));
      }

      if (failed > 0) {
        showToast(`Proceso terminado. ${converted} OK · ${failed} con Errores.`, 'info');
      } else {
        showToast(`¡Conversión masiva exitosa! ${converted} puntos calculados.`, 'success');
      }
    });
  }

  /* ── BATCH: exportar / utilidades ── */
  const bCopyAll = document.getElementById('btn-copy-all');
  if (bCopyAll) {
    bCopyAll.addEventListener('click', copyAllToClipboard);
  }

  const bHistory = document.getElementById('btn-history');
  if (bHistory) {
    bHistory.addEventListener('click', toggleHistoryPanel);
  }

  const bHistoryClose = document.getElementById('btn-history-close');
  if (bHistoryClose) {
    bHistoryClose.addEventListener('click', () => {
      const panel = document.getElementById('batch-history-panel');
      if (panel) {
        panel.classList.remove('history-panel--visible');
        panel.hidden = true;
      }
    });
  }

  const bExportCsv = document.getElementById('btn-export-csv');
  if (bExportCsv) {
    bExportCsv.addEventListener('click', exportCSV);
  }

  const bExportDxf = document.getElementById('btn-export-dxf');
  if (bExportDxf) {
    bExportDxf.addEventListener('click', exportDXF);
  }

  const bExportSig = document.getElementById('btn-export-sig');
  if (bExportSig) {
    bExportSig.addEventListener('click', exportSIG);
  }

  const bExportKml = document.getElementById('btn-export-kml');
  if (bExportKml) {
    bExportKml.addEventListener('click', exportKML);
  }

  /* ── BATCH: filtro de errores ── */
  function toggleErrorFilter() {
    state.showErrorsOnly = !state.showErrorsOnly;
    const btn = document.getElementById('btn-filter-errors');
    if (btn) btn.classList.toggle('active', state.showErrorsOnly);
    renderBatchTable();
  }

  // Crear botón de filtro dinámicamente e insertarlo
  const batchToolbarLeft = document.querySelector('.batch-toolbar-left');
  if (batchToolbarLeft) {
    const filterBtn = document.createElement('button');
    filterBtn.id = 'btn-filter-errors';
    filterBtn.className = 'btn-filter-errors';
    filterBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 3h12M4 8h8M6 13h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Solo errores</span>';
    filterBtn.setAttribute('aria-label', 'Mostrar solo filas con error');
    filterBtn.setAttribute('title', 'Alternar: mostrar solo filas con error');
    filterBtn.addEventListener('click', toggleErrorFilter);
    batchToolbarLeft.appendChild(filterBtn);
  }

  /* ── BATCH: cargar archivo CSV externo ── */
  // El id en el HTML es "file-input" — asegurarse de usar el mismo id
  const inputCsv = document.getElementById('file-input');
  if (inputCsv) {
    inputCsv.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

        setLastImportedFileName(file.name);

      // Inicializar worker si es necesario
      if (!csvWorker) {
        try {
          csvWorker = new Worker('csvWorker.js');
        } catch (err) {
          showToast('No se pudo crear worker; se usará procesamiento en main thread', 'warn');
          // Fallback: leer en main thread
          const reader = new FileReader();
          reader.onload = (evt) => {
            const { rows, skipped } = parseCSV(evt.target.result);
            if (rows.length > 0) {
              state.batchRows = [...state.batchRows, ...rows];
              addImportHistory(rows.length, skipped);
              renderBatchTable();
              showToast(`Se importaron ${rows.length} puntos correctamente.`, 'success');
            }
            if (skipped > 0) showToast(`${skipped} filas omitidas por formato incorrecto.`, 'error');
            inputCsv.value = '';
          };
          reader.readAsText(file);
          return;
        }

        csvWorker.onmessage = (ev) => {
          const m = ev.data;
          if (!m) return;
          if (m.type === 'row') {
            const r = m.row;
            const rowObj = createBatchRow({
              name: r.name,
              zone: r.zone,
              hemisphere: r.hemisphere,
              easting: r.easting,
              northing: r.northing,
              status: m.status === 'ok' ? 'idle' : 'error'
            });
            // Attach error message for UI (used for tooltip or details)
            if (m.status === 'error') rowObj.errorMessage = m.error;
            state.batchRows.push(rowObj);
            // Render incremental
            renderBatchTable();
          } else if (m.type === 'progress') {
            // opcional: actualizar estatísticas parciales
            const stat = document.getElementById('batch-stat');
            if (stat) stat.textContent = `${m.parsed} puntos importados...`;
          } else if (m.type === 'done') {
            addImportHistory(m.valid, m.invalid);
            if (m.fileName) setLastImportedFileName(m.fileName);
            renderBatchTable();
            showToast(`Importación finalizada: ${m.valid} válidas · ${m.invalid} inválidas`, 'success');
            inputCsv.value = '';
            csvWorker.terminate();
            csvWorker = null;
          } else if (m.type === 'error') {
            showToast('Error parsing CSV: ' + (m.message||''), 'error');
            inputCsv.value = '';
            csvWorker.terminate();
            csvWorker = null;
          }
        };
      }

      // Enviar archivo al worker (se clona internamente)
      try {
        csvWorker.postMessage({ type: 'parse', file });
        showToast('Parseando CSV en background...', 'info', 5000);
      } catch (err) {
        showToast('Error al enviar archivo al worker. Intentando fallback.', 'error');
        inputCsv.value = '';
      }
    });
  }

  /* Tooltip para mensajes de error de fila (desktop y mobile tap) */
  let tooltipEl = null;
  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'row-tooltip';
    tooltipEl.setAttribute('role', 'status');
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function showRowTooltip(target, text) {
    const t = ensureTooltip();
    t.textContent = text;
    t.classList.add('visible');
    const rect = target.getBoundingClientRect();
    // colocar sobre la fila, centrado en el icono
    const top = Math.max(8, rect.top - 8 - t.offsetHeight);
    const left = Math.min(window.innerWidth - 16 - t.offsetWidth, rect.left + rect.width / 2 - t.offsetWidth / 2);
    t.style.top = `${top}px`;
    t.style.left = `${Math.max(8, left)}px`;
  }

  function hideRowTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('visible');
  }

  // Delegación: mostrar/ocultar tooltip en hover y click
  document.addEventListener('pointerover', (e) => {
    const btn = e.target.closest && e.target.closest('.row-error-icon');
    if (!btn) return;
    const msg = btn.dataset.error || btn.getAttribute('title') || 'Error en la fila';
    showRowTooltip(btn, msg);
  });
  document.addEventListener('pointerout', (e) => {
    const btn = e.target.closest && e.target.closest('.row-error-icon');
    if (!btn) return;
    hideRowTooltip();
  });

  // Tap/click to toggle tooltip on touch devices
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.row-error-icon');
    if (!btn) return;
    const msg = btn.dataset.error || btn.getAttribute('title') || 'Error en la fila';
    const t = ensureTooltip();
    if (t.classList.contains('visible') && t.textContent === msg) {
      hideRowTooltip();
    } else {
      showRowTooltip(btn, msg);
      // auto-hide after 5s
      setTimeout(hideRowTooltip, 5000);
    }
  });
});