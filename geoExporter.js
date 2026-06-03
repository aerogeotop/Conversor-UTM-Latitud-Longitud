/* geoExporter.js
   Módulo de exportación geomática: DXF y GeoJSON
*/

'use strict';

export function getExportBaseName(lastImportedFileName, fallback) {
  const raw = (lastImportedFileName || fallback || '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return safe || (fallback || 'export');
}

export function getExportDateLabel() {
  const today = new Date();
  return `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;
}

function toDMS(dd, isLat) {
  const abs = Math.abs(dd);
  const deg = Math.floor(abs);
  const minFlt = (abs - deg) * 60;
  const min = Math.floor(minFlt);
  const sec = ((minFlt - min) * 60).toFixed(4);
  let dir;
  if (isLat) dir = dd >= 0 ? 'N' : 'S'; else dir = dd >= 0 ? 'E' : 'O';
  return `${deg}° ${min}′ ${sec}″ ${dir}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportDXF(rows, lastImportedFileName) {
  const converted = (rows || []).filter(r => r && r.status === 'ok');
  if (converted.length === 0) return { ok: false, message: 'No hay puntos convertidos' };

  // Build ENTITIES: POINT and TEXT (with group 40 height and group 1 identifier)
  const entities = converted.map((r, idx) => {
    const x = Number.parseFloat(String(r.easting || 0).replace(/,/g,'.')).toFixed(4);
    const y = Number.parseFloat(String(r.northing || 0).replace(/,/g,'.')).toFixed(4);
    const z = '0.0';
    const label = escapeXml(r.name || `PT-${idx+1}`);

    // POINT entity
    const point = [`0`,`POINT`,`8`,`0`,`10`,`${x}` ,`20`,`${y}` ,`30`,`${z}`].join('\n');

    // TEXT entity — include group 40 (height) and group 1 (identifier/text content)
    // Height chosen to be 1.5 to avoid Group 40 errors in Civil3D
    const text = [
      `0`,`TEXT`,`8`,`0`,`10`,`${x}`,`20`,`${y}`,`30`,`${z}`,
      `40`,`1.5`,
      `1`,`${label}`
    ].join('\n');

    return point + '\n' + text;
  }).join('\n');

  const dxf = [`0`,`SECTION`,`2`,`HEADER`,`0`,`ENDSEC`,`0`,`SECTION`,`2`,`ENTITIES`, entities, `0`,`ENDSEC`,`0`,`EOF`].join('\n') + '\n';

  const blob = new Blob([dxf], { type: 'application/dxf;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getExportBaseName(lastImportedFileName,'GeoToolkits_DXF')}_${getExportDateLabel()}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, count: converted.length };
}

export function exportSIG(rows, lastImportedFileName) {
  const converted = (rows || []).filter(r => r && r.status === 'ok');
  if (converted.length === 0) return { ok: false, message: 'No hay puntos convertidos' };

  const features = converted.map((r) => {
    const lon = Number.parseFloat(String(r.lon || 0)).toFixed(7);
    const lat = Number.parseFloat(String(r.lat || 0)).toFixed(7);
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number.parseFloat(lon), Number.parseFloat(lat)]
      },
      properties: {
        Nombre: r.name,
        Zona: r.zone,
        Hemisferio: r.hemisphere,
        Este: r.easting,
        Norte: r.northing,
        Latitud_DD: Number.parseFloat(lat),
        Longitud_DD: Number.parseFloat(lon),
        Latitud_DMS: toDMS(Number.parseFloat(lat), true),
        Longitud_DMS: toDMS(Number.parseFloat(lon), false),
      }
    };
  });

  const geojson = { type: 'FeatureCollection', features };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${getExportBaseName(lastImportedFileName,'GeoToolkits_SIG')}_${getExportDateLabel()}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true, count: converted.length };
}

export default { exportDXF, exportSIG, getExportBaseName, getExportDateLabel };
