import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// OAuth configuration
function getOAuth2Client() {
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Helper to extract tokens from request cookies
function getAuthClientFromReq(req: Request) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) return null;

  const tokensCookie = req.cookies.google_tokens;
  if (!tokensCookie) return null;

  try {
    const tokens = JSON.parse(Buffer.from(tokensCookie, 'base64').toString('utf-8'));
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  } catch (err) {
    console.error('Failed to parse tokens cookie:', err);
    return null;
  }
}

// ================= API ROUTES =================

// 1. Auth Status
app.get('/api/auth/status', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.json({ authenticated: false, hasCredentials: !!getOAuth2Client() });
  }

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    return res.json({
      authenticated: true,
      hasCredentials: true,
      user: {
        name: userInfo.data.name,
        email: userInfo.data.email,
        picture: userInfo.data.picture,
      },
    });
  } catch (err: any) {
    console.error('Auth status error:', err.message);
    res.clearCookie('google_tokens');
    return res.json({ authenticated: false, hasCredentials: !!getOAuth2Client(), error: err.message });
  }
});

// 2. Get Auth URL
app.get('/api/auth/url', (req: Request, res: Response) => {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(400).json({ error: 'Google OAuth Credentials (CLIENT_ID / CLIENT_SECRET) not found.' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  return res.json({ url });
});

// 3. Auth Callback
app.get('/api/auth/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Authorization code missing.');
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(500).send('OAuth client misconfigured.');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const tokenBase64 = Buffer.from(JSON.stringify(tokens)).toString('base64');

    // Save tokens in httpOnly cookie for 30 days
    res.cookie('google_tokens', tokenBase64, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
    });

    // Send clean HTML response that closes popup if opened as popup, or redirects to homepage
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Đăng nhập thành công</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f6f8; }
            .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
            h2 { color: #10b981; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Đăng nhập Google thành công!</h2>
            <p>Đang quay lại ứng dụng...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage('oauth-success', '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Callback error:', err);
    return res.status(500).send(`Xác thực thất bại: ${err.message}`);
  }
});

// 4. Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('google_tokens');
  return res.json({ success: true });
});

// 5. List user Spreadsheets
app.get('/api/sheets/list', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.status(401).json({ error: 'Chưa đăng nhập Google.' });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id, name, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 20,
    });

    return res.json({ files: response.data.files || [] });
  } catch (err: any) {
    console.error('List sheets error:', err);
    return res.status(500).json({ error: err.message || 'Không thể lấy danh sách Google Sheets' });
  }
});

// 6. Create a new Spreadsheet
app.post('/api/sheets/create', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.status(401).json({ error: 'Chưa đăng nhập Google.' });
  }

  const { title } = req.body;
  const sheetTitle = title || `Sổ Chi Tiêu Hàng Ngày - ${new Date().toLocaleDateString('vi-VN')}`;

  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    // Create spreadsheet
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: sheetTitle,
        },
        sheets: [
          {
            properties: {
              title: 'Danh sách chi tiêu',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID missing in creation response');
    }

    // Set headers
    const headers = [['Ngày tháng', 'Tên người chi tiêu', 'Tên chi phí', 'Số tiền (VNĐ)', 'Thời gian tạo']];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "'Danh sách chi tiêu'!A1:E1",
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: headers,
      },
    });

    // Format header row background & font
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.45, blue: 0.85 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
        ],
      },
    });

    return res.json({
      spreadsheetId,
      title: sheetTitle,
      spreadsheetUrl: createRes.data.spreadsheetUrl,
    });
  } catch (err: any) {
    console.error('Create sheet error:', err);
    return res.status(500).json({ error: err.message || 'Không thể tạo Google Sheet mới' });
  }
});

// 7. Get Data from Spreadsheet
app.get('/api/sheets/data', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.status(401).json({ error: 'Chưa đăng nhập Google.' });
  }

  const { spreadsheetId } = req.query;
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    return res.status(400).json({ error: 'Thiếu spreadsheetId.' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:E1000',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return res.json({ items: [] });
    }

    // Skip header row
    const items = rows.slice(1).map((row, idx) => ({
      id: `sheet-${idx + 1}`,
      date: row[0] || '',
      spender: row[1] || '',
      expense: row[2] || '',
      amount: parseFloat(String(row[3]).replace(/[^0-9.-]+/g, '')) || 0,
      createdAt: row[4] || '',
    }));

    return res.json({ items });
  } catch (err: any) {
    console.error('Read sheet data error:', err);
    return res.status(500).json({ error: err.message || 'Không thể tải dữ liệu từ Google Sheet' });
  }
});

// 8. Sync/Save Data to Spreadsheet
app.post('/api/sheets/save', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.status(401).json({ error: 'Chưa đăng nhập Google.' });
  }

  const { spreadsheetId, items } = req.body;
  if (!spreadsheetId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Header row + data rows
    const values = [
      ['Ngày tháng', 'Tên người chi tiêu', 'Tên chi phí', 'Số tiền (VNĐ)', 'Thời gian cập nhật'],
      ...items.map((item: any) => [
        item.date || new Date().toLocaleDateString('vi-VN'),
        item.spender || '',
        item.expense || '',
        typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0,
        new Date().toLocaleString('vi-VN'),
      ]),
    ];

    // Clear sheet content first to overwrite cleanly
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'A1:E1000',
    });

    // Write updated values
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return res.json({ success: true, count: items.length });
  } catch (err: any) {
    console.error('Save sheet error:', err);
    return res.status(500).json({ error: err.message || 'Không thể lưu dữ liệu vào Google Sheet' });
  }
});

// 9. Append single item automatically to target Google Sheet (chitieucuaNganvaToan.xlsx)
app.post('/api/sheets/append-default', async (req: Request, res: Response) => {
  const oauth2Client = getAuthClientFromReq(req);
  if (!oauth2Client) {
    return res.status(401).json({ error: 'Chưa kết nối tài khoản Google. Vui lòng bấm nút Kết nối Google Sheets trước.' });
  }

  const { date, spender, expense, amount, targetSheetName } = req.body;
  const targetFileName = targetSheetName || "chitieucuaNganvaToan.xlsx";

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Find spreadsheet by name in Google Drive
    const searchName = targetFileName.replace(/'/g, "\\'");
    const baseName = targetFileName.replace(/\.xlsx$/i, '').replace(/'/g, "\\'");

    const listRes = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name='${searchName}' or name='${baseName}')`,
      fields: 'files(id, name, webViewLink)',
      pageSize: 5,
    });

    let spreadsheetId = '';
    let webViewLink = '';
    let sheetTitle = targetFileName;

    if (listRes.data.files && listRes.data.files.length > 0) {
      spreadsheetId = listRes.data.files[0].id!;
      sheetTitle = listRes.data.files[0].name!;
      webViewLink = listRes.data.files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    } else {
      // Create new Google Sheet named targetFileName
      const createRes = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: targetFileName,
          },
          sheets: [
            {
              properties: {
                title: 'Danh sách chi tiêu',
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        },
      });

      spreadsheetId = createRes.data.spreadsheetId!;
      sheetTitle = targetFileName;
      webViewLink = createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Set headers
      const headers = [['Ngày tháng', 'Tên người chi tiêu', 'Tên chi phí', 'Số tiền (VNĐ)', 'Thời gian gửi']];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'Danh sách chi tiêu'!A1:E1",
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers },
      });

      // Format header row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.1, green: 0.5, blue: 0.8 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
          ],
        },
      });
    }

    // Append new row
    const row = [
      date || new Date().toLocaleDateString('vi-VN'),
      spender || '',
      expense || '',
      typeof amount === 'number' ? amount : parseFloat(amount) || 0,
      new Date().toLocaleString('vi-VN'),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    return res.json({
      success: true,
      spreadsheetId,
      spreadsheetName: sheetTitle,
      webViewLink,
      appendedRow: row,
    });
  } catch (err: any) {
    console.error('Append sheet error:', err);
    return res.status(500).json({ error: err.message || 'Không thể tự động lưu vào Google Sheet' });
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
