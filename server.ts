import 'dotenv/config';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const _dirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// RestDB.io Configuration
const RESTDB_BASE_URL = 'https://dtoan-e791.restdb.io/rest';
const RESTDB_API_KEY = '6a74c1d37eee3e669ebc395c';

const restdbHeaders = {
  'x-apikey': RESTDB_API_KEY,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
};

// In-memory + disk file fallback database if RestDB collection is not created or unreachable
import fs from 'fs';

const BACKUP_FILE_PATH = path.join(process.cwd(), 'expenses_backup.json');
const INCOMES_BACKUP_FILE = path.join(process.cwd(), 'incomes_backup.json');

function loadMemoryExpenses(): any[] {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const data = fs.readFileSync(BACKUP_FILE_PATH, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (e) {
    console.error('Error reading expenses_backup.json:', e);
  }
  return [];
}

function saveMemoryExpenses(expenses: any[]) {
  try {
    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(expenses, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing expenses_backup.json:', e);
  }
}

let memoryExpenses: any[] = loadMemoryExpenses();

function loadMemoryIncomes(): Record<string, { ngan?: number; ton?: number }> {
  try {
    if (fs.existsSync(INCOMES_BACKUP_FILE)) {
      const data = fs.readFileSync(INCOMES_BACKUP_FILE, 'utf-8');
      return JSON.parse(data) || {};
    }
  } catch (e) {
    console.error('Error reading incomes_backup.json:', e);
  }
  return {};
}

function saveMemoryIncomes(incomes: Record<string, { ngan?: number; ton?: number }>) {
  try {
    fs.writeFileSync(INCOMES_BACKUP_FILE, JSON.stringify(incomes, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing incomes_backup.json:', e);
  }
}

let memoryIncomes = loadMemoryIncomes();

// Helper function to query restdb with collection fallback
async function fetchFromRestDB(collection: string, options: RequestInit = {}) {
  const url = `${RESTDB_BASE_URL}/${collection}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...restdbHeaders,
      ...(options.headers || {}),
    },
  });
  return response;
}

async function requestWithCollectionFallback(
  endpointPath: string, // e.g. '' or '/<id>'
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
  const possibleCollections = ['chitieu', 'expenses', 'sochitieu', 'chi_tieu', 'data', 'items'];

  for (const col of possibleCollections) {
    try {
      const res = await fetchFromRestDB(`${col}${endpointPath}`, options);
      const text = await res.text();
      const isNotFound = text.includes('Dataobject') || text.includes('not found') || res.status === 404;

      if (res.ok && !isNotFound) {
        let parsed = {};
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        return { ok: true, status: res.status, data: parsed };
      }
    } catch (err) {
      // Continue to next collection or fallback
    }
  }

  return { ok: false, status: 500, errorText: 'RestDB collection not available' };
}

// ================= RESTDB EXPENSES API ROUTES =================

// 1. Get all expenses from restdb
app.get('/api/expenses', async (req: Request, res: Response) => {
  const result = await requestWithCollectionFallback('');
  if (!result.ok) {
    // If RestDB collection doesn't exist or errors, return memoryExpenses as fallback
    console.warn('RestDB returned error, using fallback memory storage:', result.errorText);
    return res.json({ success: true, items: memoryExpenses, source: 'local' });
  }

  const items = Array.isArray(result.data) ? result.data : [];
  return res.json({ success: true, items, source: 'restdb' });
});

// 2. Add expense(s) to restdb using requested schema
app.post('/api/expenses', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
      return res.status(400).json({ error: 'Không có dữ liệu hợp lệ để thêm' });
    }

    const result = await requestWithCollectionFallback('', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!result.ok) {
      console.warn('RestDB insert failed, saving to local memory backup:', result.errorText);
      const memDoc = Array.isArray(payload)
        ? payload.map((p: any, idx: number) => ({ ...p, _id: 'mem-' + Date.now() + '-' + idx }))
        : { ...payload, _id: 'mem-' + Date.now() };

      if (Array.isArray(memDoc)) {
        memoryExpenses = [...memDoc, ...memoryExpenses];
      } else {
        memoryExpenses = [memDoc, ...memoryExpenses];
      }
      saveMemoryExpenses(memoryExpenses);

      return res.json({
        success: true,
        data: memDoc,
        source: 'local',
      });
    }

    return res.json({
      success: true,
      data: result.data,
      source: 'restdb',
    });
  } catch (err: any) {
    console.error('Error adding expenses:', err);
    return res.status(500).json({ error: err.message || 'Không thể lưu dữ liệu' });
  }
});

// 3. Update expense in restdb or memory
app.put('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const exists = memoryExpenses.some((m) => m._id === id);
    if (exists) {
      memoryExpenses = memoryExpenses.map((m) => (m._id === id ? { ...m, ...updateData } : m));
    } else {
      memoryExpenses = [{ _id: id, ...updateData }, ...memoryExpenses];
    }
    saveMemoryExpenses(memoryExpenses);

    if (id.startsWith('mem-') || id.startsWith('loc-')) {
      return res.json({ success: true, data: updateData, source: 'local' });
    }

    const result = await requestWithCollectionFallback(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    return res.json({ success: true, data: result.ok ? result.data : updateData, source: result.ok ? 'restdb' : 'local' });
  } catch (err: any) {
    console.error('Error updating expense:', err);
    return res.status(500).json({ error: err.message || 'Lỗi cập nhật' });
  }
});

// 4. Delete single expense by ID from restdb or memory
app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    memoryExpenses = memoryExpenses.filter((m) => m._id !== id);
    saveMemoryExpenses(memoryExpenses);

    if (id.startsWith('mem-') || id.startsWith('loc-')) {
      return res.json({ success: true, data: { _id: id }, source: 'local' });
    }

    const result = await requestWithCollectionFallback(`/${id}`, {
      method: 'DELETE',
    });

    return res.json({ success: true, data: result.ok ? result.data : { _id: id }, source: result.ok ? 'restdb' : 'local' });
  } catch (err: any) {
    console.error('Error deleting expense:', err);
    return res.status(500).json({ error: err.message || 'Lỗi xoá dữ liệu' });
  }
});

// ================= INCOMES API ROUTES =================
// 1. Get all monthly incomes
app.get('/api/incomes', (req: Request, res: Response) => {
  return res.json({ success: true, incomes: memoryIncomes });
});

// 2. Save/update monthly income for Ngân / Tòn
app.post('/api/incomes', (req: Request, res: Response) => {
  try {
    const { month, ngan, ton, incomes } = req.body;

    if (incomes && typeof incomes === 'object') {
      memoryIncomes = { ...memoryIncomes, ...incomes };
      saveMemoryIncomes(memoryIncomes);
      return res.json({ success: true, incomes: memoryIncomes });
    }

    if (!month) {
      return res.status(400).json({ error: 'Thiếu tháng áp dụng' });
    }

    const currentMonthData = memoryIncomes[month] || {};
    memoryIncomes[month] = {
      ngan: ngan !== undefined ? Number(ngan) || 0 : currentMonthData.ngan || 0,
      ton: ton !== undefined ? Number(ton) || 0 : currentMonthData.ton || 0,
    };

    saveMemoryIncomes(memoryIncomes);
    return res.json({ success: true, incomes: memoryIncomes, monthData: memoryIncomes[month] });
  } catch (err: any) {
    console.error('Error saving income:', err);
    return res.status(500).json({ error: err.message || 'Lỗi lưu thu nhập' });
  }
});

// Start Express Server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
