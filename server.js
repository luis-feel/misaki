import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data_store.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

function mergeCollection(existingArr = [], incomingArr = [], deletedIds = []) {
  const map = new Map();
  const delSet = new Set(deletedIds || []);
  if (Array.isArray(existingArr)) {
    for (const item of existingArr) {
      if (item && item.id && !delSet.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  if (Array.isArray(incomingArr)) {
    for (const item of incomingArr) {
      if (item && item.id) {
        if (item._deleted || delSet.has(item.id)) {
          map.delete(item.id);
        } else {
          const prev = map.get(item.id) || {};
          map.set(item.id, { ...prev, ...item });
        }
      }
    }
  }
  return Array.from(map.values());
}

// Endpoints de persistencia global sincronizada
app.get('/api/sync', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return res.json(JSON.parse(content || '{}'));
    }
    return res.json({});
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', (req, res) => {
  try {
    const payload = req.body || {};
    let existing = {};
    if (fs.existsSync(DB_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}'); } catch(e){}
    }

    const merged = {
      productos: mergeCollection(existing.productos, payload.productos, payload.deleted_productos),
      compras: mergeCollection(existing.compras, payload.compras, payload.deleted_compras),
      envios: mergeCollection(existing.envios, payload.envios, payload.deleted_envios),
      recepciones: mergeCollection(existing.recepciones, payload.recepciones, payload.deleted_recepciones),
      usuarios: mergeCollection(existing.usuarios, payload.usuarios, payload.deleted_usuarios),
      config: { ...(existing.config || {}), ...(payload.config || {}) },
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return res.json({
      ok: true,
      productos_count: merged.productos.length,
      compras_count: merged.compras.length,
      updated_at: merged.updated_at
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
