import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Safe image insertion that prevents ANY decode/compression failures from crashing PDF generation
const addImageSafe = (doc: any, base64: string, x: number, y: number, w: number, h: number) => {
  if (!base64 || typeof base64 !== 'string') return;
  try {
    let format = 'JPEG';
    if (base64.startsWith('data:image/png')) format = 'PNG';
    else if (base64.startsWith('data:image/webp')) format = 'WEBP';
    else if (base64.startsWith('data:image/gif')) format = 'GIF';
    
    doc.addImage(base64, format, x, y, w, h);
  } catch (err) {
    console.warn("Failed to add image to PDF, skipping safely...", err);
  }
};

export const generateOcorrenciaPDF = (data: any, options?: { save?: boolean, returnBase64?: boolean }) => {
  const doc = new jsPDF() as any;
  const shouldSave = options?.save ?? true;
  const shouldReturnBase64 = options?.returnBase64 ?? false;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Helper to safely call autoTable
  let lastY = 60;
  const callAutoTable = (optionsTable: any) => {
    try {
      autoTable(doc, optionsTable);
      if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') {
        lastY = doc.lastAutoTable.finalY;
      } else {
        const rowCount = (optionsTable.body || []).length;
        const estHeight = 15 + (rowCount * 8);
        lastY = (optionsTable.startY || lastY) + estHeight;
      }
    } catch (err) {
      console.error("Error in autoTable call:", err);
      const rowCount = (optionsTable.body || []).length;
      const estHeight = 15 + (rowCount * 8);
      lastY = (optionsTable.startY || lastY) + estHeight;
    }
  };

  const getFinalY = () => {
    return lastY;
  };

  const formattedDate = data.data ? new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR') : '---';

  // Header
  doc.setFillColor(13, 27, 62);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Guardian GT', 20, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE OCORRÊNCIA OPERACIONAL', 20, 32);
  
  doc.text(`DATA: ${formattedDate}`, pageWidth - 70, 25);
  doc.text(`TURNO: ${data.turno || '---'}`, pageWidth - 70, 32);

  // General Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DADOS GERAIS DO PLANTÃO', 20, 55);
  
  callAutoTable({
    startY: 60,
    head: [['Supervisor', 'Viatura', 'KM Inicial', 'KM Final']],
    body: [[
      data.supervisor || data.nomeSupervisor || '---',
      data.viaturaId || data.placaViatura || '---',
      data.kmInicial || '0',
      data.kmFinal || '0'
    ]],
    theme: 'striped',
    headStyles: { fillColor: [13, 27, 62] }
  });
  
  lastY = getFinalY();

  // Viatura photos inside PDF
  const viaturaPhotos = [
    { label: 'Frente', img: data.fotoViaturaFrente },
    { label: 'Trás', img: data.fotoViaturaTras },
    { label: 'Lado Esquerdo', img: data.fotoViaturaEsquerda },
    { label: 'Lado Direito', img: data.fotoViaturaDireita },
    { label: 'Painel', img: data.fotoViaturaPainel },
  ].filter(p => !!p.img);

  if (viaturaPhotos.length > 0) {
    const startY = lastY + 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Vistoria da Viatura:', 20, startY);
    
    let currentX = 20;
    viaturaPhotos.forEach((photo) => {
      addImageSafe(doc, photo.img, currentX, startY + 4, 25, 20);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(photo.label, currentX + 12.5, startY + 27, { align: 'center' });
      currentX += 33;
    });
    lastY = startY + 29;
    if (doc.lastAutoTable) {
      doc.lastAutoTable.finalY = lastY;
    }
  }

  // Coverages
  if (data.coberturas && data.coberturas.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. COBERTURAS REALIZADAS', 20, lastY + 15);
    
    callAutoTable({
      startY: lastY + 20,
      head: [['Vigilante Coberto', 'Motivo', 'Vigilante Substituto', 'Tipo', 'Horas']],
      body: data.coberturas.map((c: any) => [
        c.nomeVigilanteCoberto || '---',
        c.motivoAusencia || '---',
        c.nomeVigilanteCobriu || '---',
        c.tipoCobertura || '---',
        `${c.horasCobertas || 0}h`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [13, 27, 62] }
    });
    
    lastY = getFinalY();
  }

  // Fiscalization
  const pageHeight = doc.internal.pageSize.getHeight();
  if (data.postosVisitados && data.postosVisitados.length > 0) {
    if (lastY + 25 > pageHeight - 15) {
      doc.addPage();
      lastY = 15;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. FISCALIZAÇÃO DE POSTOS', 20, lastY + 15);
    lastY = lastY + 15;
    
    data.postosVisitados.forEach((visit: any, index: number) => {
      // Calculate estimated space needed for this visit card block to avoid splits or cutoffs
      let spaceNeeded = 12; // Title space
      let splitMotivo: string[] = [];
      if (visit.realizado === false) {
        const motivo = visit.motivoNaoRealizacao || 'Sem justificativa preenchida.';
        splitMotivo = doc.splitTextToSize(`Justificativa / Observação: ${motivo}`, pageWidth - 40);
        spaceNeeded += 12 + (splitMotivo.length * 5);
      } else {
        spaceNeeded += 14; // Vigilantes line, coords line
        const rowCount = (visit.checklist || []).length;
        spaceNeeded += 15 + (rowCount * 8.5) + 6; // Checklist title, headers, row count plus padding
      }

      if (lastY + spaceNeeded > pageHeight - 15) {
        doc.addPage();
        lastY = 15; // Set starting Y point at top of new page
      }

      const startY = lastY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${visit.nomePosto || '---'} - Horário: ${visit.horario || '---'}`, 20, startY);
      
      if (visit.realizado === false) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38); // Red color for non-realized
        doc.text('STATUS: FISCALIZAÇÃO NÃO REALIZADA', 20, startY + 6);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105); // Slate slate-600
        doc.text(splitMotivo, 20, startY + 12);
        
        lastY = startY + 12 + (splitMotivo.length * 4.5);
        doc.setTextColor(0, 0, 0); // Restore text color to black
      } else {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const vigs = visit.vigilantesPresentes?.map((v: any) => v.nome || v.displayName).filter(Boolean).join(', ') || 'Nenhum informado';
        doc.text(`Vigilantes Presentes: ${vigs}`, 20, startY + 5);
        doc.text(`Localização: ${visit.latitude ? `${Number(visit.latitude).toFixed(6)}, ${Number(visit.longitude).toFixed(6)}` : 'Não informada'}`, 20, startY + 10);

        if (visit.fotos && visit.fotos[0]) {
          addImageSafe(doc, visit.fotos[0], pageWidth - 45, startY - 2, 25, 20);
        }
        
        callAutoTable({
          startY: startY + 15,
          head: [['Item Verificado', 'Status', 'Observação']],
          body: (visit.checklist || []).map((item: any) => [
            item.nome || '---',
            item.status || '---',
            item.observacao || '---'
          ]),
          columnStyles: {
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' }
          },
          headStyles: { fillColor: [13, 27, 62] }
        });
        
        lastY = getFinalY();
      }
    });
  }

  // Conclusion
  const splitObs = doc.splitTextToSize(data.observacoesGerais || 'Sem observações adicionais.', pageWidth - 40);
  const conclusionSpace = 30 + (splitObs.length * 5);
  
  if (lastY + conclusionSpace > pageHeight - 15) {
    doc.addPage();
    lastY = 15;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. CONCLUSÃO', 20, lastY + 15);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(splitObs, 20, lastY + 25);

  const fileDate = data.data || new Date().toISOString().split('T')[0];
  const fileTurno = data.turno || 'plantao';
  const fileName = `ocorrencia_${fileDate}_${fileTurno}.pdf`;
  
  if (shouldSave) {
    try {
      doc.save(fileName);
    } catch (saveErr) {
      console.error("Error saving PDF file directly from doc:", saveErr);
    }
  }

  if (shouldReturnBase64) {
    try {
      return {
        base64: doc.output('datauristring').split(',')[1],
        fileName
      };
    } catch (outErr) {
      console.error("Error outputting base64:", outErr);
    }
  }
};
