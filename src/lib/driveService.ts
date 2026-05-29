export const driveService = {
  async uploadFile(pdfBase64: string, filename: string, folderName: string = 'LIVROS DE OCORRENCIA GUARDIAN GT') {
    const response = await fetch('/api/upload-drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfBase64,
        fileName: filename,
        folderName
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao enviar para o Drive');
    }

    return response.json();
  },

  async sendToGoogleAppsScript(pdfBase64: string, supervisor: string) {
    const response = await fetch('/api/send-to-gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        supervisor,
        base64: pdfBase64
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Erro ao enviar para a automação') as any;
      err.details = error.details;
      throw err;
    }

    return response.json();
  }
};
