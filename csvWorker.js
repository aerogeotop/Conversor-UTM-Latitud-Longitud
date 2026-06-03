// csvWorker.js — Worker para parseo de CSV usando PapaParse
// Importar PapaParse desde CDN
importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');

self.onmessage = function (evt) {
  const msg = evt.data;
  if (!msg || msg.type !== 'parse' || !msg.file) return;
  const fileName = msg.fileName || '';

  const file = msg.file;
  let parsed = 0;
  let valid = 0;
  let invalid = 0;
  let skipped = 0;

  Papa.parse(file, {
    skipEmptyLines: true,
    worker: false, // ya estamos en un worker
    step: function(results, parser) {
      const row = results.data;
      parsed++;

      // Normalizar columnas
      const cols = row.map(c => (c === undefined || c === null) ? '' : String(c).trim());
      if (cols.length < 5) {
        invalid++;
        self.postMessage({ type: 'row', status: 'error', row: { name: cols[0] || `PT-${parsed}`, zone: cols[1]||'', hemisphere: cols[2]||'', easting: cols[3]||'', northing: cols[4]||'' }, error: 'Formato incorrecto: columnas insuficientes', rowIndex: parsed });
        return;
      }

      const [name, zoneRaw, hemiRaw, eRaw, nRaw] = cols;
      const zone = parseInt(zoneRaw.replace(/\D/g,''), 10);
      const hemisphere = String(hemiRaw || '').toUpperCase();
      const easting = parseFloat(String(eRaw).replace(/,/g,'.').replace(/[^\d.-]/g,''));
      const northing = parseFloat(String(nRaw).replace(/,/g,'.').replace(/[^\d.-]/g,''));

      const rowObj = { name: name || `PT-${parsed}`, zone: zoneRaw, hemisphere: hemisphere || '', easting: eRaw, northing: nRaw };

      // Validaciones básicas
      const errs = [];
      if (isNaN(zone) || zone < 1 || zone > 60) errs.push('Zona inválida');
      if (hemisphere !== 'N' && hemisphere !== 'S') errs.push('Hemisferio inválido');
      if (isNaN(easting)) errs.push('Este inválido');
      if (isNaN(northing)) errs.push('Norte inválido');

      if (errs.length > 0) {
        invalid++;
        self.postMessage({ type: 'row', status: 'error', row: rowObj, error: errs.join('; '), rowIndex: parsed });
      } else {
        valid++;
        // Enviar fila válida; mantener los valores como strings originales para consistencia en UI
        self.postMessage({ type: 'row', status: 'ok', row: rowObj, rowIndex: parsed });
      }

      if (parsed % 500 === 0) {
        self.postMessage({ type: 'progress', parsed, valid, invalid });
      }
    },
    complete: function() {
      self.postMessage({ type: 'done', parsed, valid, invalid, skipped, fileName });
    },
    error: function(err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
  });
};
