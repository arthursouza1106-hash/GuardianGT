export const emailService = {
  async sendReport(to: string[], pdfBase64: string, fileName: string, subject?: string, body?: string) {
    try {
      const response = await fetch('/api/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          pdfBase64,
          fileName,
          subject,
          body
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar e-mail');
      }

      return await response.json();
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }
};
