import { Readable } from 'stream';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from 'resend';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

console.log("[Server] Starting node process (GT Guardian)...");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Google Drive Auth Setup (Server-to-Server)
let drive: any = null;
try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    });
    drive = google.drive({ version: 'v3', auth });
    console.log("[Server] Google Drive (Service Account) initialized");
  } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    drive = google.drive({ version: 'v3', auth });
    console.log("[Server] Google Drive (OAuth Refresh Token) initialized");
  } else {
    console.warn("[Server] Google Drive credentials not found in environment variables.");
  }
} catch (e) {
  console.error("[Server] Google Drive initialization error:", e);
}

const app = express();

// Middleware
app.use(express.json({ limit: '100mb' }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    emailActive: !!resend, 
    driveActive: !!drive,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/upload-drive", async (req, res) => {
  const { pdfBase64, fileName, folderName } = req.body;

  if (!drive) {
    return res.status(503).json({ error: "Google Drive não configurado no servidor" });
  }

  try {
    // 1. Find or Create Folder
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!folderId && folderName) {
      const listRes = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });
      
      if (listRes.data.files.length > 0) {
        folderId = listRes.data.files[0].id;
      } else {
        const createRes = await drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = createRes.data.id;
      }
    }

    // 2. Upload File
    const buffer = Buffer.from(pdfBase64, 'base64');
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : [],
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(buffer),
      },
    });

    console.log(`[Drive] File uploaded successfully: ${fileName} (${response.data.id})`);
    res.json({ success: true, fileId: response.data.id });
  } catch (error: any) {
    console.error("[Drive API Error]:", error);
    const msg = error.message || "Erro desconhecido no Google Drive";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/send-to-gas", async (req, res) => {
  const { supervisor, base64 } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "Faltando o conteúdo do PDF em base64" });
  }

  const payload = {
    supervisor: supervisor || "Supervisor Operacional",
    base64: base64
  };

  try {
    console.log(`[Google Apps Script] Sending POST request with body size: ${JSON.stringify(payload).length} bytes`);
    const gasResponse = await fetch('https://script.google.com/macros/s/AKfycbxMb6CEi8TXSjB5CZttZLJa1YgyoHZqYmkKwlt5IhuUvw2xdp61DO-MQ-ayMGb2-2XjxQ/exec', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await gasResponse.text();
    console.log(`[Google Apps Script] Response status: ${gasResponse.status}, redirected: ${gasResponse.redirected}`);
    console.log(`[Google Apps Script] First 1000 chars of response:`, responseText.substring(0, 1000));

    // Check if the response matches a Google Login page, which indicates the script is not publicly accessible
    if (responseText.includes("accounts.google.com") || responseText.includes("Sign in")) {
      console.warn("[Google Apps Script] WARNING: Response contains references to Google Sign-In button/login. This indicates that the Web App was deployed with access restricted to 'Only myself' or 'Anyone with Google account' instead of 'Anyone'.");
      return res.status(403).json({ 
        error: "Script do Google Apps requer autenticação. Verifique se o Web App foi publicado com acesso para 'Qualquer pessoa' (Anyone).",
        details: "Google redirected to a sign-in page."
      });
    }

    // Check for obvious Google Script Exception or Error indicators in the response text
    if (responseText.includes("ScriptError") || responseText.includes("Exception:") || responseText.includes("Authorization is required") || responseText.includes("Error on line")) {
      console.error("[Google Apps Script Runtime Exception]:", responseText);
      return res.status(502).json({
        error: "A execução do Script falhou no Google. Mensagem de erro detectada na resposta.",
        details: responseText.substring(0, 300)
      });
    }

    // Try to parse as JSON to see if Google Apps Script returned a JSON error structured payload
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(responseText);
    } catch (e) {
      // Not JSON, which is common for Google Apps Script redirects or plain/text responses
    }

    if (parsedJson && (parsedJson.status === "error" || parsedJson.success === false || parsedJson.error)) {
      console.error("[Google Apps Script Business Error]:", parsedJson);
      return res.status(502).json({
        error: parsedJson.error || parsedJson.message || "A automação retornou um status de erro.",
        details: JSON.stringify(parsedJson)
      });
    }

    // Successful execution
    res.json({ 
      success: true, 
      status: gasResponse.status, 
      preview: responseText.length > 150 ? responseText.substring(0, 150) + "..." : responseText,
      fullResponse: responseText
    });
  } catch (err: any) {
    console.error("[Google Apps Script API Error]:", err);
    res.status(500).json({ error: err.message || "Erro no envio para o Google Apps Script" });
  }
});

app.post("/api/send-report", async (req, res) => {
  const { to, subject, body, pdfBase64, fileName } = req.body;

  if (!resend) {
    console.warn("[Server] RESEND_API_KEY not found. Simulating email send.");
    return res.json({ success: true, message: "Simulated send (API key missing)" });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Guardian GT <reports@guardian.gt>', // This would need to be a verified domain
      to: Array.isArray(to) ? to : [to],
      subject: subject || 'Relatório de Ocorrência Operacional',
      html: body || '<p>Segue em anexo o relatório de ocorrência operacional.</p>',
      attachments: [
        {
          filename: fileName || 'relatorio.pdf',
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      return res.status(400).json({ error });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware and port listener
async function configureHostingAndDev() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only run standard server listener if not inside Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

configureHostingAndDev();

export default app;
