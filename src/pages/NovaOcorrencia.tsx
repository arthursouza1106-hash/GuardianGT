import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  AlertTriangle, 
  MapPin, 
  User, 
  FileText,
  Trash2,
  Camera,
  AlertCircle,
  ListChecks,
  Plus,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIPOS_OCORRENCIA, PRIORIDADES, MOTIVOS_FALTA, TIPOS_COBERTURA, DIAS_SEMANA } from '@/constants';
import { Roteiro, Posto, Vigilante, ChecklistItem, PostoVisitado, ChecklistVerificacao } from '@/types';
import { useNavigate } from 'react-router-dom';
import { genericService } from '@/lib/firestoreService';
import { useAuth } from '@/lib/AuthContext';
import { generateOcorrenciaPDF } from '@/lib/pdfGenerator';
import { emailService } from '@/services/emailService';
import { driveService } from '@/lib/driveService';
import { Clock, Download, Mail, Cloud, Send } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const getDayNameFromDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  const dayIndex = date.getDay(); // 0 is Sunday
  const mapping = [6, 0, 1, 2, 3, 4, 5]; // Sunday maps to index 6 in DIAS_SEMANA
  return DIAS_SEMANA[mapping[dayIndex]] || '';
};

const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert canvas image to jpeg with target quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(event.target?.result as string); // fallback on error
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const STEPS = [
  { id: 1, title: 'Informações do Plantão', icon: Clock },
  { id: 2, title: 'Coberturas Realizadas', icon: User },
  { id: 3, title: 'Fiscalização de Postos', icon: MapPin },
  { id: 4, title: 'Conclusão e Assinatura', icon: Check },
];

export default function OcorrenciaWizard() {
  const navigate = useNavigate();
  const { userData, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [driveUploadSuccess, setDriveUploadSuccess] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isSendingToGAS, setIsSendingToGAS] = useState(false);
  const [gasUploadSuccess, setGasUploadSuccess] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [gasResponseText, setGasResponseText] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<any>(null);
  const [pdfData, setPdfData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isViagemMode, setIsViagemMode] = useState(false);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeVisitId, setActiveVisitId] = React.useState<string | null>(null);
  
  const [postos, setPostos] = useState<Posto[]>([]);
  const [viaturas, setViaturas] = useState<any[]>([]);
  const [vigilantes, setVigilantes] = useState<Vigilante[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [motivosFalta, setMotivosFalta] = useState<string[]>(MOTIVOS_FALTA);
  const [tiposCobertura, setTiposCobertura] = useState<string[]>(TIPOS_COBERTURA);
  const [existingOcorrencias, setExistingOcorrencias] = useState<any[]>([]);
  
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [hasEmails, setHasEmails] = useState(false);
  const [lastRoteiroKey, setLastRoteiroKey] = useState<string>('');
  const [lastRoteiroId, setLastRoteiroId] = useState<string | null>(null);

  const initialDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<any>({
    data: initialDate,
    diaSemana: getDayNameFromDate(initialDate),
    supervisor: '',
    turno: '',
    viaturaId: '',
    kmInicial: '',
    kmFinal: '',
    fotoViaturaFrente: '',
    fotoViaturaTras: '',
    fotoViaturaEsquerda: '',
    fotoViaturaDireita: '',
    fotoViaturaPainel: '',
    coberturas: [],
    postosVisitados: [],
    observacoesGerais: '',
    status: 'Finalizada'
  });

  // Coverage form state
  const [coverageEdit, setCoverageEdit] = useState({
    vigilanteCobertoId: '',
    motivoAusencia: '',
    vigilanteCobriuId: '',
    postoId: '',
    tipoCobertura: '',
    horasCobertas: '1',
  });

  useEffect(() => {
    // Fetch dependencies with real-time subscriptions to guarantee instant and updated data load
    const unsubPostos = genericService.subscribe<Posto>('postos', (data) => {
      setPostos(data);
    });
    const unsubVigilantes = genericService.subscribe<Vigilante>('vigilantes', (data) => {
      setVigilantes(data);
    });
    const unsubViaturas = genericService.subscribe<any>('viaturas', (data) => {
      setViaturas(data);
    });
    const unsubChecklist = genericService.subscribe<ChecklistItem>('checklistItems', (data) => {
      setChecklistItems(data);
    });
    const unsubRoteiros = genericService.subscribe<Roteiro>('roteiros', (data) => {
      setRoteiros(data);
    });
    const unsubOcorrencias = genericService.subscribe<any>('ocorrencias', (data) => {
      setExistingOcorrencias(data);
    });
    
    // Load dynamic lists
    genericService.list<any>('motivos_falta').then(data => {
      if (data.length > 0) setMotivosFalta(data.map(d => d.nome));
    });
    genericService.list<any>('tipos_cobertura').then(data => {
      if (data.length > 0) setTiposCobertura(data.map(d => d.nome));
    });

    genericService.list<any>('settings').then(settings => {
      const emailSettings = settings.find(s => s.id === 'email_group');
      setHasEmails(emailSettings && emailSettings.emails?.length > 0);
      setLoadingSettings(false);
    });

    return () => {
      unsubPostos();
      unsubVigilantes();
      unsubViaturas();
      unsubChecklist();
      unsubRoteiros();
      unsubOcorrencias();
    };
  }, []);

  useEffect(() => {
    if (userData?.displayName && !formData.supervisor) {
      setFormData((prev: any) => ({ ...prev, supervisor: userData.displayName }));
    }
  }, [userData]);

  useEffect(() => {
    if (formData.turno === 'Viagem') {
      setIsViagemMode(true);
    } else {
      setIsViagemMode(false);
    }
  }, [formData.turno]);

  useEffect(() => {
    if (isViagemMode) {
      return;
    }
    if (postos.length > 0 && roteiros.length > 0 && formData.diaSemana && formData.turno && currentStep === 3) {
      const today = formData.diaSemana;
      const todayNorm = today.toLowerCase().trim();
      const actualTurno = isViagemMode ? 'viagem' : (formData.turno || '').toLowerCase().trim();
      const currentRoteiroKey = `${todayNorm}_${actualTurno}`;
      
      const roteiro = roteiros.find(r => {
        const rDayNorm = (r.diaSemana || '').toLowerCase().trim();
        const rTurnoNorm = (r.turno || '').toLowerCase().trim();
        return rDayNorm === todayNorm && rTurnoNorm === actualTurno && (!r.status || r.status === 'Ativo');
      });
      
      if (lastRoteiroKey !== currentRoteiroKey || formData.postosVisitados.length === 0) {
        setLastRoteiroKey(currentRoteiroKey);
        
        if (roteiro) {
          const newVisits = roteiro.postos.map(pRef => {
            const posto = postos.find(p => p.id === pRef.id);
            if (!posto) return null;

            const checklist: ChecklistVerificacao[] = checklistItems
              .filter(item => {
                if (posto.armado) {
                  return item.aplicacao === 'Armado' || item.aplicacao === 'Ambos';
                } else {
                  return item.aplicacao === 'Desarmado' || item.aplicacao === 'Ambos';
                }
              })
              .map(item => ({
                itemId: item.id,
                name: item.nome, // Support either item.name or item.nome
                nome: item.nome || item.name || '',
                status: 'Não verificado',
              }));

            return {
              id: Math.random().toString(36).substr(2, 9),
              postoId: posto.id,
              nomePosto: posto.nome,
              horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              situacao: 'Normal',
              vigilantesPresentes: [],
              fotos: [],
              checklist,
              realizado: undefined,
              doRoteiro: true
            };
          }).filter(v => v !== null);

          setFormData((prev: any) => ({
            ...prev,
            postosVisitados: newVisits
          }));
          setSuccessMessage(`Roteiro para ${today} (${isViagemMode ? 'Viagem' : formData.turno}) carregado automaticamente`);
        } else {
          setFormData((prev: any) => ({
            ...prev,
            postosVisitados: []
          }));
        }
      }
    }
  }, [postos, roteiros, formData.diaSemana, formData.turno, checklistItems, currentStep, lastRoteiroKey, isViagemMode]);

  const roleNorm = (userData?.role || '').toLowerCase().trim();
  const isArthur = 
    userData?.matricula?.toLowerCase().trim() === 'arthur' || 
    userData?.matricula?.toLowerCase().trim() === 'arthursouza1106@gmail.com' ||
    userData?.displayName?.toLowerCase().includes('arthur') ||
    userData?.uid === 'u4' ||
    userData?.uid === 'u8';
  const isAdmin = roleNorm === 'admin' || isArthur;
  const isSupervisor = roleNorm === 'supervisor' && !isAdmin;

  // Check if supervisor already submitted for the selected date
  const hasSubmittedToday = isSupervisor && existingOcorrencias.some(o => {
    const isSameDate = o.data === formData.data;
    const matchesId = o.supervisorId && user?.uid && String(o.supervisorId).toLowerCase().trim() === String(user.uid).toLowerCase().trim();
    const matchesNameSuper = o.nomeSupervisor && user?.displayName && String(o.nomeSupervisor).toLowerCase().trim() === String(user.displayName).toLowerCase().trim();
    const matchesSuper = o.supervisor && user?.displayName && String(o.supervisor).toLowerCase().trim() === String(user.displayName).toLowerCase().trim();
    return isSameDate && (matchesId || matchesNameSuper || matchesSuper);
  });

  const nextStep = () => {
    setError(null);
    
    if (currentStep === 1) {
      if (hasSubmittedToday) {
        setError('Você já enviou um Livro de Ocorrência para esta data. Não é permitido enviar múltiplos reports no mesmo dia.');
        return;
      }
      if (!formData.turno) {
        setError('Por favor, selecione o Turno (Diurno, Noturno ou Viagem).');
        return;
      }
      if (!formData.viaturaId) {
        setError('Por favor, selecione a Viatura.');
        return;
      }
      if (!formData.kmInicial) {
        setError('Por favor, informe o KM Inicial da Viatura.');
        return;
      }
      if (!formData.fotoViaturaEsquerda || !formData.fotoViaturaDireita || !formData.fotoViaturaFrente || !formData.fotoViaturaTras || !formData.fotoViaturaPainel) {
        setError('Por favor, realize a vistoria enviando todas as 5 fotos da viatura (Esquerda, Direita, Frente, Trás e Painel).');
        return;
      }
    }
    
    if (currentStep === 3) {
      if (formData.postosVisitados.length === 0) {
        setError('Nenhum posto agendado para hoje. Adicione um posto manualmente ou verifique a data.');
        return;
      }

      const allDone = formData.postosVisitados.every((v: PostoVisitado) => {
        return v.finalizado === true;
      });

      if (!allDone) {
        setError('Por favor, conclua e feche a fiscalização de todos os postos (clicando no botão "Ok / Concluir" em cada um deles) antes de prosseguir.');
        return;
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const addCoverage = () => {
    setError(null);
    if (!coverageEdit.vigilanteCobertoId || !coverageEdit.vigilanteCobriuId || !coverageEdit.postoId) {
      setError('Por favor, preencha o posto e os vigilantes envolvidos.');
      return;
    }
    
    if (coverageEdit.vigilanteCobertoId === coverageEdit.vigilanteCobriuId) {
      return;
    }
    
    const coberto = vigilantes.find(v => v.id === coverageEdit.vigilanteCobertoId);
    const cobriu = vigilantes.find(v => v.id === coverageEdit.vigilanteCobriuId);
    const posto = postos.find(p => p.id === coverageEdit.postoId);

    const newCoverage = {
      ...coverageEdit,
      id: Math.random().toString(36).substr(2, 9),
      nomeVigilanteCoberto: coberto?.nome || '',
      nomeVigilanteCobriu: cobriu?.nome || '',
      nomePosto: posto?.nome || '',
      usuarioLogado: userData?.displayName || userData?.username || '---'
    };

    setFormData({ ...formData, coberturas: [...formData.coberturas, newCoverage] });
    setCoverageEdit({
      vigilanteCobertoId: '',
      motivoAusencia: '',
      vigilanteCobriuId: '',
      postoId: '',
      tipoCobertura: '',
      horasCobertas: '1',
    });
  };

  const removeCoverage = (id: string) => {
    setFormData({ ...formData, coberturas: formData.coberturas.filter((c: any) => c.id !== id) });
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayIndex = date.getDay(); // 0 is Sunday
    const mapping = [6, 0, 1, 2, 3, 4, 5]; // Sunday maps to index 6 in DIAS_SEMANA
    return DIAS_SEMANA[mapping[dayIndex]];
  };

  const addPostoVisitado = (postoId: string) => {
    const posto = postos.find(p => p.id === postoId);
    if (!posto) return;

    // Filter items based on posto type (Armado/Desarmado)
    const checklist: ChecklistVerificacao[] = checklistItems
      .filter(item => {
        if (posto.armado) {
          return item.aplicacao === 'Armado' || item.aplicacao === 'Ambos';
        } else {
          return item.aplicacao === 'Desarmado' || item.aplicacao === 'Ambos';
        }
      })
      .map(item => ({
        itemId: item.id,
        nome: item.nome,
        status: 'Não verificado',
      }));

    const newVisit: PostoVisitado = {
      id: Math.random().toString(36).substr(2, 9),
      postoId: posto.id,
      nomePosto: posto.nome,
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      situacao: 'Normal',
            vigilantesPresentes: [],
            fotos: [],
      checklist,
      realizado: undefined
    };

    setFormData({ ...formData, postosVisitados: [...formData.postosVisitados, newVisit] });
  };

  const handleStartFiscalizacao = async (visitId: string) => {
    setActiveVisitId(visitId);
    setIsCapturing(true);

    // 1. Get Location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateVisit(visitId, { 
            latitude: position.coords.latitude, 
            longitude: position.coords.longitude 
          });
          // 2. Trigger Camera
          fileInputRef.current?.click();
        },
        (error) => {
          console.error("Error getting location:", error);
          setError("Não foi possível obter sua localização. Por favor, verifique as permissões do navegador.");
          setIsCapturing(false);
          setActiveVisitId(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError("Seu navegador não suporta geolocalização.");
      setIsCapturing(false);
      setActiveVisitId(null);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeVisitId) {
      try {
        const base64String = await compressImage(file);
        updateVisit(activeVisitId, { 
          fotos: [base64String],
          realizado: true,
          motivoNaoRealizacao: ''
        });
      } catch (err) {
        console.error("Erro ao compactar imagem capturada:", err);
      } finally {
        setIsCapturing(false);
        setActiveVisitId(null);
      }
    } else {
      setIsCapturing(false);
      setActiveVisitId(null);
    }
  };

  const updateVisit = (visitId: string, updates: Partial<PostoVisitado>) => {
    setFormData({
      ...formData,
      postosVisitados: formData.postosVisitados.map((v: PostoVisitado) => {
        if (v.id !== visitId) return v;
        return { ...v, ...updates };
      })
    });
  };

  const addVigilanteToVisit = (visitId: string, vigilanteId: string) => {
    const vig = vigilantes.find(v => v.id === vigilanteId);
    if (!vig) return;

    setFormData({
      ...formData,
      postosVisitados: formData.postosVisitados.map((v: PostoVisitado) => {
        if (v.id !== visitId) return v;
        if (v.vigilantesPresentes.some(vp => vp.id === vigilanteId)) return v;
        return {
          ...v,
          vigilantesPresentes: [...v.vigilantesPresentes, { id: vig.id, nome: vig.nome }]
        };
      })
    });
  };

  const removeVigilanteFromVisit = (visitId: string, vigilanteId: string) => {
    setFormData({
      ...formData,
      postosVisitados: formData.postosVisitados.map((v: PostoVisitado) => {
        if (v.id !== visitId) return v;
        return {
          ...v,
          vigilantesPresentes: v.vigilantesPresentes.filter(vp => vp.id !== vigilanteId)
        };
      })
    });
  };

  const updateChecklist = (visitId: string, itemId: string, updates: Partial<ChecklistVerificacao>) => {
    setFormData({
      ...formData,
      postosVisitados: formData.postosVisitados.map((v: PostoVisitado) => {
        if (v.id !== visitId) return v;
        return {
          ...v,
          checklist: v.checklist.map(item => 
            item.itemId === itemId ? { ...item, ...updates } : item
          )
        };
      })
    });
  };

  const handleFinalize = async () => {
    if (!user) return;
    
    if (hasSubmittedToday) {
      setError('Operação cancelada: Registro já enviado para esta data.');
      return;
    }
    
    setIsSaving(true);
    try {
      const finalData = {
        ...formData,
        supervisorId: user.uid,
        nomeSupervisor: userData?.displayName || 'Supervisor Operacional',
        createdAt: new Date().toISOString()
      };
      
      await genericService.create('ocorrencias', finalData);
      setSavedData(finalData);
      
      // Generate PDF and get Base64
      let generatedPdf: any = null;
      try {
        generatedPdf = generateOcorrenciaPDF(finalData, { save: true, returnBase64: true });
        setPdfData(generatedPdf);
        
        // Create Blob URL
        const pdfBase64 = generatedPdf.base64;
        const binaryString = window.atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (pdfErr) {
        console.error("Auto-download PDF failed:", pdfErr);
      }
 
      // Non-blocking: background emails dispatch
      genericService.list<any>('settings')
        .then(async (settings) => {
          const emailSettings = settings.find(s => s.id === 'email_group');
          if (emailSettings && emailSettings.emails?.length > 0 && generatedPdf) {
            try {
              const [y, m, d] = finalData.data.split('-');
              const displayDate = `${d}/${m}/${y}`;
              
              await emailService.sendReport(
                emailSettings.emails, 
                generatedPdf.base64, 
                generatedPdf.fileName,
                `LIVRO DE OCORRÊNCIAS - ${displayDate} - ${finalData.nomeSupervisor.toUpperCase()}`,
                `
                  <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
                    <p>Segue em anexo livro de ocorrências referente ao plantão do dia <strong>${displayDate}</strong>.</p>
                    <br/>
                    <p>Atenciosamente,<br/><strong>Equipe Guardian GT</strong></p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 10px; color: #94a3b8;">Mensagem gerada automaticamente pelo sistema operacional.</p>
                  </div>
                `
              );
              console.log("Emails enviados com sucesso no background");
            } catch (mailErr) {
              console.error("Erro ao enviar e-mails automatizados:", mailErr);
            }
          }
        })
        .catch(err => console.error("Erro ao carregar e-mails para envio de relatório:", err));

      // Non-blocking: background Google Drive upload
      if (generatedPdf?.base64) {
        setIsUploadingToDrive(true);
        driveService.uploadFile(generatedPdf.base64, generatedPdf.fileName)
          .then(() => {
            setDriveUploadSuccess(true);
            console.log("Upload para o Drive concluído no background");
          })
          .catch((driveErr) => {
            console.error("Erro ao subir no Drive via servidor:", driveErr);
          })
          .finally(() => {
            setIsUploadingToDrive(false);
          });
      }

      // Non-blocking: background Google Apps Script integration
      if (generatedPdf?.base64) {
        setIsSendingToGAS(true);
        setGasError(null);
        setGasResponseText(null);
        driveService.sendToGoogleAppsScript(generatedPdf.base64, finalData.nomeSupervisor)
          .then((resData) => {
            setGasUploadSuccess(true);
            if (resData && resData.preview) {
              setGasResponseText(resData.preview);
            }
            console.log("PDF automatic post-send on finalization successful", resData);
          })
          .catch((gasErr) => {
            console.error("Erro no envio automático para o Apps Script:", gasErr);
            setGasError(gasErr?.message || "Falha ao enviar ao Drive Operacional");
            if (gasErr?.details) {
              setGasResponseText(gasErr.details);
            }
          })
          .finally(() => {
            setIsSendingToGAS(false);
          });
      }
 
      setShowSuccess(true);
    } catch (error) {
      console.error('Finalize error:', error);
      setError('Erro ao salvar ocorrência. Verifique os campos e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="max-w-xl mx-auto mt-10 p-8 md:p-12 bg-white rounded-3xl border border-slate-200 shadow-2xl text-center space-y-8 animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-green-600 uppercase tracking-tight">Registro realizado com sucesso!</h2>
          <p className="text-slate-500 mt-1 text-sm">O registro do plantão foi processado com sucesso e o arquivo foi disponibilizado.</p>
          
          <p className="text-[10px] text-brand-600 font-black mt-4 uppercase tracking-widest flex items-center justify-center gap-2">
            {!loadingSettings && (hasEmails 
              ? <><Mail className="w-3 h-3" /> Relatórios disparados para o grupo operacional</> 
              : "Documento gerado e disponível para consulta.")}
          </p>

          <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
             <div className="flex items-center justify-center gap-2 text-slate-500">
                <Cloud className={cn("w-4 h-4", driveUploadSuccess ? "text-green-500" : "text-slate-400")} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {driveUploadSuccess ? "Sincronizado com Nuvem de Backup" : isUploadingToDrive ? "Sincronizando com Backup..." : "Sincronização em Nuvem Ativa"}
                </span>
             </div>
             <div className="flex flex-col items-center justify-center gap-1 text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <Send className={cn("w-4 h-4", gasUploadSuccess ? "text-blue-500 animate-pulse" : gasError ? "text-rose-500" : "text-slate-400")} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {gasUploadSuccess ? "Enviado ao Google Drive Operacional" : isSendingToGAS ? "Enviando ao Drive Operacional..." : gasError ? "Erro no Envio ao Drive" : "Envio ao Drive Operacional Ativo"}
                  </span>
                </div>
                {gasError && (
                  <span className="text-[9px] text-rose-500 font-bold max-w-xs text-center leading-tight">
                    {gasError}
                  </span>
                )}
                {gasResponseText && (
                  <div className="mt-3 w-full p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-600 font-mono text-left break-words overflow-y-auto max-h-36">
                    <p className="font-sans font-bold text-slate-700 uppercase tracking-wider mb-1 text-[9px]">Retorno do Script do Google:</p>
                    {gasResponseText}
                  </div>
                )}
             </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => {
              if (savedData) {
                generateOcorrenciaPDF(savedData, { save: true });
              } else if (pdfUrl && pdfData) {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = pdfData.fileName;
                link.click();
              }
            }} 
            className="w-full h-14 text-sm font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 flex items-center justify-center shadow-lg"
          >
            <Download className="w-5 h-5" />
            Baixar Relatório (PDF)
          </Button>
          <Button 
            onClick={() => navigate('/ocorrencias/list')} 
            className="w-full h-12 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 border border-slate-100 rounded-xl"
          >
            Acessar Histórico (Livro de Ocorrências)
          </Button>
        </div>
      </div>
    );
  }

  const matchingRoteiro = roteiros.find(r => {
    const today = formData.diaSemana || getDayName(formData.data);
    const todayNorm = (today || '').toLowerCase().trim();
    const targetTurno = isViagemMode ? 'viagem' : (formData.turno || '').toLowerCase().trim();
    const rDayNorm = (r.diaSemana || '').toLowerCase().trim();
    const rTurnoNorm = (r.turno || '').toLowerCase().trim();
    return rDayNorm === todayNorm && rTurnoNorm === targetTurno && (!r.status || r.status === 'Ativo');
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Nova Ocorrência</h2>
          <p className="text-slate-500">Registro operacional do supervisor de campo.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/ocorrencias/list')}>Sair sem salvar</Button>
      </div>

      {/* stepper */}
      <div className="space-y-4">
        <div className="relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 -z-10"></div>
          <div className="flex justify-between items-center sm:px-4">
            {STEPS.map((step) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-50 px-2 sm:px-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-slate-50",
                    isActive ? "bg-brand-950 text-brand-400 shadow-lg shadow-brand-950/20" : 
                    isCompleted ? "bg-green-500 text-white" : "bg-white border-2 border-slate-300 text-slate-400"
                  )}>
                    {isCompleted ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest hidden md:block text-center max-w-[120px]",
                    isActive ? "text-brand-950" : "text-slate-400"
                  )}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-center md:hidden pb-1">
          <p className="text-[10px] font-black text-brand-950 uppercase tracking-widest bg-brand-50/50 py-1.5 px-4 rounded-full inline-block border border-brand-100/40">
            Etapa {currentStep} de 4: {STEPS[currentStep - 1].title}
          </p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8">
          {successMessage && (
            <div className="mb-6 p-3 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black uppercase tracking-widest border border-emerald-100 text-center animate-bounce">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-xs font-black uppercase tracking-widest border border-red-100 text-center">
              {error}
            </div>
          )}
          {currentStep === 1 && (
            <div className="space-y-6">
              {hasSubmittedToday && (
                <div id="block_today_alert" className="p-5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-4 animate-in fade-in duration-300">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0 shadow-xs">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1.5">
                    <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest">Acesso Restrito: Registro já Enviado</h4>
                    <p className="text-xs text-rose-600 leading-relaxed font-semibold">
                      O supervisor <strong className="font-black text-rose-700">{userData?.displayName}</strong> já cadastrou um livro de ocorrências para <strong className="font-black text-rose-700">{formData.data.split('-').reverse().join('/')}</strong>. O envio de múltiplos registros por dia é bloqueado para supervisores.
                    </p>
                    <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-3">
                      <Button 
                        type="button"
                        id="btn_access_history"
                        variant="secondary" 
                        size="sm" 
                        onClick={() => navigate('/ocorrencias/list')}
                        className="text-[10px] font-black uppercase tracking-widest bg-white hover:bg-slate-50 border-rose-200 text-rose-800 shadow-sm"
                      >
                        Acessar Histórico (Visualizar)
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField 
                  label="Data do Plantão" 
                  type="date" 
                  value={formData.data} 
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setFormData({
                      ...formData, 
                      data: selectedDate,
                      diaSemana: getDayNameFromDate(selectedDate)
                    });
                  }} 
                />
                
                <FormField 
                  label="Dia da Semana" 
                  as="select" 
                  value={formData.diaSemana || ''} 
                  onChange={(e) => setFormData({...formData, diaSemana: e.target.value})}
                >
                  <option value="">Selecione o Dia...</option>
                  {DIAS_SEMANA.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </FormField>

                <FormField label="Nome do Supervisor" value={formData.supervisor} readOnly className="bg-slate-50 cursor-not-allowed" />
                
                <FormField 
                  label="Turno" 
                  as="select" 
                  value={formData.turno} 
                  onChange={(e) => setFormData({...formData, turno: e.target.value})}
                  required
                >
                  <option value="">Selecione o Turno...</option>
                  <option value="Diurno">Diurno</option>
                  <option value="Noturno">Noturno</option>
                </FormField>
              </div>

              {/* Centralized Viatura selector on a dedicated row */}
              <div className="border-t border-b border-slate-100 py-6 mt-6 flex flex-col items-center">
                <FormField 
                  label="Viatura Selecionada (Placa)" 
                  as="select" 
                  value={formData.viaturaId} 
                  onChange={(e) => setFormData({...formData, viaturaId: e.target.value})} 
                  required
                  className="w-full max-w-md text-center"
                >
                  <option value="">Selecione a Viatura...</option>
                  {viaturas.map(v => <option key={v.id} value={v.placa}>{v.placa}</option>)}
                </FormField>
              </div>

              {/* KM Inicial & Final on the subsequent row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <FormField label="KM Inicial" type="number" placeholder="0" value={formData.kmInicial} onChange={(e) => setFormData({...formData, kmInicial: e.target.value})} />
                <FormField label="KM Final" type="number" placeholder="0" value={formData.kmFinal} onChange={(e) => setFormData({...formData, kmFinal: e.target.value})} />
              </div>

                <div className="pt-6 border-t border-slate-100 mt-6">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">
                    Vistoria da Viatura (Obrigatório - 5 Fotos)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { key: 'fotoViaturaEsquerda', label: 'Lado Esquerdo' },
                      { key: 'fotoViaturaDireita', label: 'Lado Direito' },
                      { key: 'fotoViaturaFrente', label: 'Frente' },
                      { key: 'fotoViaturaTras', label: 'Trás' },
                      { key: 'fotoViaturaPainel', label: 'Painel' },
                    ].map((item) => {
                      const photoValue = formData[item.key];
                      return (
                        <div key={item.key} className="space-y-2">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block text-center truncate">
                            {item.label}
                          </span>
                          {photoValue ? (
                            <div className="relative h-24 rounded-xl border border-slate-200 overflow-hidden group shadow-xs">
                              <img src={photoValue} alt={item.label} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, [item.key]: '' })}
                                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-90 hover:opacity-100 transition-all shadow-md cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 cursor-pointer hover:bg-slate-50 hover:border-brand-250 transition-all group">
                              <Camera className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors mb-1.5 animate-pulse" />
                              <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 text-center px-1">
                                Capturar
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const base64String = await compressImage(file);
                                      setFormData((prev: any) => ({ ...prev, [item.key]: base64String }));
                                    } catch (err) {
                                      console.error("Erro ao compactar foto do veículo:", err);
                                    }
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              {/* Coverages Table (Top as summary) */}
              {formData.coberturas.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Coberturas Registradas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.coberturas.map((coverage: any) => (
                      <div key={coverage.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] bg-brand-50 text-brand-900 px-1.5 py-0.5 rounded font-bold uppercase">{coverage.tipoCobertura || 'Cobertura'}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{coverage.horasCobertas}h de duração</span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-700">Posto: <span className="text-slate-900">{coverage.nomePosto}</span></p>
                            <p className="text-xs font-bold text-slate-700">Ausente: <span className="text-slate-900">{coverage.nomeVigilanteCoberto}</span></p>
                            <p className="text-xs font-bold text-slate-700">Substituto: <span className="text-slate-900">{coverage.nomeVigilanteCobriu}</span></p>
                            <p className="text-[10px] text-slate-400 italic">Motivo: {coverage.motivoAusencia}</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeCoverage(coverage.id);
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-950" /> Adicionar Cobertura
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <SearchableSelect 
                    label="Posto da Cobertura" 
                    placeholder="Pesquisar posto..."
                    value={coverageEdit.postoId}
                    onChange={(val) => setCoverageEdit({...coverageEdit, postoId: val})}
                    options={postos.map(p => ({ id: p.id, label: p.nome }))}
                    className="md:col-span-2"
                  />
                  
                  <SearchableSelect 
                    label="Vigilante Ausente" 
                    placeholder="Pesquisar vigilante..."
                    value={coverageEdit.vigilanteCobertoId}
                    error={coverageEdit.vigilanteCobertoId !== '' && coverageEdit.vigilanteCobertoId === coverageEdit.vigilanteCobriuId}
                    errorMessage={coverageEdit.vigilanteCobertoId !== '' && coverageEdit.vigilanteCobertoId === coverageEdit.vigilanteCobriuId ? "Este vigilante já foi selecionado na outra opção" : undefined}
                    onChange={(val) => setCoverageEdit({...coverageEdit, vigilanteCobertoId: val})}
                    options={vigilantes.map(v => ({ id: v.id, label: v.nome, subLabel: v.matricula }))}
                  />

                  <FormField label="Motivo da Ausência" as="select" value={coverageEdit.motivoAusencia} onChange={(e) => setCoverageEdit({...coverageEdit, motivoAusencia: e.target.value})}>
                    <option value="">Selecione...</option>
                    {motivosFalta.map(m => <option key={m} value={m}>{m}</option>)}
                  </FormField>

                  <SearchableSelect 
                    label="Vigilante Substituto" 
                    placeholder="Pesquisar substituto..."
                    value={coverageEdit.vigilanteCobriuId}
                    error={coverageEdit.vigilanteCobriuId !== '' && coverageEdit.vigilanteCobriuId === coverageEdit.vigilanteCobertoId}
                    errorMessage={coverageEdit.vigilanteCobriuId !== '' && coverageEdit.vigilanteCobriuId === coverageEdit.vigilanteCobertoId ? "Este vigilante já foi selecionado na outra opção" : undefined}
                    onChange={(val) => setCoverageEdit({...coverageEdit, vigilanteCobriuId: val})}
                    options={vigilantes.map(v => ({ id: v.id, label: v.nome, subLabel: v.matricula }))}
                  />

                  <FormField label="PAGAMENTO DA COBERTURA" as="select" value={coverageEdit.tipoCobertura} onChange={(e) => setCoverageEdit({...coverageEdit, tipoCobertura: e.target.value})}>
                    <option value="">Selecione...</option>
                    {tiposCobertura.map(t => <option key={t} value={t}>{t}</option>)}
                  </FormField>

                  <FormField label="QTD DE HORAS" as="select" value={coverageEdit.horasCobertas} onChange={(e) => setCoverageEdit({...coverageEdit, horasCobertas: e.target.value})}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </FormField>

                  <FormField label="SUPERVISOR" value={userData?.displayName || '---'} readOnly className="bg-white/50 cursor-not-allowed" />
                </div>
                <div className="mt-6 flex justify-end">
                   <Button onClick={addCoverage} variant="primary" className="px-8 shadow-sm">
                      Confirmar Cobertura
                   </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Fiscalização Operacional</h3>
                  <p className="text-xs text-slate-400">
                    Dia selecionado: <span className="font-semibold text-slate-600">{formData.diaSemana || getDayName(formData.data)}</span> ({formData.turno || 'Sem Turno'})
                  </p>
                  {isViagemMode ? (
                    <div className="text-[11px] text-blue-800 font-extrabold mt-1.5 flex items-center gap-1.5 bg-blue-500/10 px-3.5 py-2 rounded-xl border border-blue-200 animate-pulse uppercase tracking-wider">
                      Modo de Viagem Ativo: Marque na lista qual(is) posto(s) deseja fiscalizar hoje
                    </div>
                  ) : matchingRoteiro ? (
                    <p className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-green-600" /> Roteiro carregado: {matchingRoteiro.nome} ({matchingRoteiro.postos?.length || 0} postos)
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600 font-semibold mt-1">
                      Nenhum roteiro automático encontrado para {formData.diaSemana || getDayName(formData.data)} ({isViagemMode ? 'Viagem' : formData.turno || 'Sem Turno'}). Adicione postos extras abaixo.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm self-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modo de Operação</span>
                    <span className="text-xs font-bold text-slate-700">Roteiro de Viagem?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsViagemMode(prev => {
                        const nextVal = !prev;
                        setLastRoteiroKey('');
                        setFormData((prevForm: any) => ({
                          ...prevForm,
                          postosVisitados: []
                        }));
                        return nextVal;
                      });
                    }}
                    className={cn(
                      "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500",
                      isViagemMode ? "bg-blue-600 animate-pulse" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        isViagemMode ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
              {isViagemMode ? (
                <div className="bg-blue-500/5 border border-blue-100 p-6 rounded-[2rem] space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-blue-900 uppercase tracking-tight">Postos de Viagem Disponíveis</h4>
                      <p className="text-[11px] text-blue-600 font-semibold uppercase">Marque as bases/unidades que você vai fiscalizar nesta viagem:</p>
                    </div>
                  </div>
                  
                  {postos.filter(p => !!p.viagem).length === 0 ? (
                    <div className="text-xs text-blue-700/70 font-semibold bg-white border border-dashed border-blue-200 py-6 text-center rounded-2xl">
                      NENHUM POSTO DO TIPO "VIAGEM" CADASTRADO NO SISTEMA.<br />
                      <span className="text-[10px] text-blue-500 mt-1 block font-normal">Por favor, acesse o menu de Postos de Serviço e marque a opção "Unidade de Viagem" em seus postos.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {postos
                        .filter(p => !!p.viagem)
                        .map(p => {
                          const isSelected = formData.postosVisitados.some((v: any) => v.postoId === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    postosVisitados: prev.postosVisitados.filter((v: any) => v.postoId !== p.id)
                                  }));
                                } else {
                                  addPostoVisitado(p.id);
                                }
                              }}
                              className={cn(
                                "flex items-start gap-3 p-4 rounded-2xl border text-left transition-all duration-200 outline-none",
                                isSelected
                                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20 scale-[1.02]"
                                  : "bg-white border-slate-100 text-slate-800 hover:border-blue-200 hover:bg-blue-50/20"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded mt-0.5 border flex items-center justify-center transition-all",
                                isSelected ? "border-white bg-white text-blue-600" : "border-slate-300"
                              )}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-bold uppercase truncate", isSelected ? "text-white" : "text-slate-800")}>
                                  {p.nome}
                                </p>
                                <p className={cn("text-[9px] font-black uppercase tracking-widest mt-0.5", isSelected ? "text-blue-200" : "text-slate-400")}>
                                  {p.armado ? 'ARMADO' : 'DESARMADO'}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div />
                  <div className="flex items-center gap-2">
                     {matchingRoteiro && (
                       <button
                         type="button"
                         onClick={() => {
                           const newVisits = matchingRoteiro.postos.map(pRef => {
                             const posto = postos.find(p => p.id === pRef.id);
                             if (!posto) return null;

                             const checklist: ChecklistVerificacao[] = checklistItems
                               .filter(item => {
                                 if (posto.armado) {
                                   return item.aplicacao === 'Armado' || item.aplicacao === 'Ambos';
                                 } else {
                                   return item.aplicacao === 'Desarmado' || item.aplicacao === 'Ambos';
                                 }
                               })
                               .map(item => ({
                                 itemId: item.id,
                                 name: item.nome, // Support both formats
                                 nome: item.nome || item.name || '',
                                 status: 'Não verificado',
                               }));

                             return {
                               id: Math.random().toString(36).substr(2, 9),
                               postoId: posto.id,
                               nomePosto: posto.nome,
                               horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                               situacao: 'Normal',
                               vigilantesPresentes: [],
                               fotos: [],
                               checklist,
                               realizado: undefined,
                               doRoteiro: true
                             };
                           }).filter(v => v !== null);

                           setFormData((prev: any) => ({
                             ...prev,
                             postosVisitados: newVisits
                           }));
                           setSuccessMessage(`Roteiro para ${formData.diaSemana} carregado com sucesso`);
                         }}
                         className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all outline-none"
                       >
                         Carregar Roteiro
                       </button>
                     )}
                     <select 
                       className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                       onChange={(e) => e.target.value && addPostoVisitado(e.target.value)}
                       value=""
                     >
                       <option value="">Adicionar Posto Extra...</option>
                       {postos
                         .filter(p => !formData.postosVisitados.some((v: any) => v.postoId === p.id))
                         .map(p => <option key={p.id} value={p.id}>{p.nome}</option>)
                       }
                     </select>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {formData.postosVisitados.map((visit: PostoVisitado) => {
                  const isOk = visit.finalizado === true;
                  const canFinalizeChecklist = visit.realizado === true && 
                                               visit.checklist.every(item => item.status !== 'Não verificado') && 
                                               visit.vigilantesPresentes && 
                                               visit.vigilantesPresentes.length > 0;
                  const canFinalizeSkipped = visit.realizado === false && 
                                             visit.motivoNaoRealizacao && 
                                             visit.motivoNaoRealizacao.trim().length > 0;

                  return (
                    <div key={visit.id} className={cn(
                      "border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm",
                      isOk ? "border-green-200 bg-green-50/10" : "border-slate-200 bg-white"
                    )}>
                      <div className={cn(
                        "px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                        isOk ? "bg-green-50/50 border-green-100" : "bg-slate-50 border-slate-200"
                      )}>
                        <div className="flex items-center gap-3 flex-wrap min-w-0">
                          {isOk ? (
                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                              <Check className="w-4 h-4" />
                            </div>
                          ) : (
                            <MapPin className="w-5 h-5 text-brand-950 shrink-0" />
                          )}
                          <span className={cn("font-bold text-sm sm:text-base break-words", isOk ? "text-green-700" : "text-slate-800")}>
                            {visit.nomePosto}
                          </span>
                          {isOk && (
                            <span className={cn(
                              "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm",
                              visit.realizado === true ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            )}>
                              {visit.realizado === true ? "Fiscalizado" : "Não Realizado"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                          {isOk ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (visit.realizado === false) {
                                  updateVisit(visit.id, { 
                                    realizado: undefined, 
                                    finalizado: false, 
                                    motivoNaoRealizacao: '' 
                                  });
                                } else {
                                  updateVisit(visit.id, { finalizado: false });
                                }
                              }}
                              className="px-3 py-1.5 border border-green-200 text-green-700 bg-white hover:bg-green-50 rounded-xl text-xs font-bold shadow-sm transition-all outline-none"
                            >
                              Reabrir Posto
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartFiscalizacao(visit.id)}
                                disabled={isCapturing}
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2",
                                  visit.realizado === true ? "bg-brand-950 text-brand-400" : "bg-white border border-slate-200 text-slate-400 hover:text-slate-600",
                                  isCapturing && activeVisitId === visit.id && "animate-pulse"
                                )}
                              >
                                {isCapturing && activeVisitId === visit.id ? (
                                  <>Obtendo Dados...</>
                                ) : (
                                  <>
                                    <Camera className="w-3.5 h-3.5" />
                                    {visit.realizado === true ? 'Checklist Atualizado' : 'Fiscalizar Agora'}
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (visit.realizado === false) {
                                    updateVisit(visit.id, { realizado: undefined, motivoNaoRealizacao: '' });
                                  } else {
                                    updateVisit(visit.id, { realizado: false, finalizado: false });
                                  }
                                }}
                                disabled={isCapturing}
                                className={cn(
                                  "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                                  visit.realizado === false ? "bg-red-500 text-white" : "bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                                )}
                              >
                                {visit.realizado === false ? 'Cancelar' : 'Não Realizar'}
                              </button>
                              {!visit.doRoteiro && (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFormData({...formData, postosVisitados: formData.postosVisitados.filter((v: any) => v.id !== visit.id)});
                                  }}
                                  className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-all ml-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {isOk ? (
                        <div className="p-6 space-y-6 bg-green-50/5 animate-in fade-in duration-300">
                          {visit.realizado === true ? (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4 border border-slate-100">
                                  <div className="w-12 h-12 bg-brand-50 text-brand-900 rounded-lg flex items-center justify-center shrink-0">
                                    <MapPin className="w-6 h-6" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coordenadas GPS</p>
                                    <p className="text-xs font-mono text-slate-600 truncate">
                                      {visit.latitude ? `${visit.latitude.toFixed(6)}, ${visit.longitude?.toFixed(6)}` : 'Não capturado'}
                                    </p>
                                  </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between gap-4 border border-slate-100">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-brand-50 text-brand-900 rounded-lg flex items-center justify-center shrink-0">
                                      <Camera className="w-6 h-6" />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto Evidência</p>
                                      <p className="text-xs text-slate-600">Imagem capturada no local</p>
                                    </div>
                                  </div>
                                  {visit.fotos?.[0] && (
                                    <img 
                                      src={visit.fotos[0]} 
                                      alt="Evidência" 
                                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                      onClick={() => window.open(visit.fotos[0], '_blank')}
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-100 animate-in fade-in duration-300">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Horário da Visita</p>
                                  <p className="text-sm font-bold text-slate-700">{visit.horario}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vigilantes Presentes</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {visit.vigilantesPresentes?.map(vp => (
                                      <span key={vp.id} className="bg-brand-50 text-brand-900 border border-brand-100/50 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">
                                        {vp.nome}
                                      </span>
                                    ))}
                                    {(!visit.vigilantesPresentes || visit.vigilantesPresentes.length === 0) && (
                                      <span className="text-xs font-bold text-amber-500 uppercase tracking-widest italic">Nenhum vigilante informado</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  <ListChecks className="w-4 h-4" /> Resultados do Checklist
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {visit.checklist.map(item => (
                                    <div key={item.itemId} className={cn(
                                      "p-3 rounded-xl border flex flex-col justify-between gap-2 shadow-sm bg-white",
                                      item.status === 'Não conforme' ? "border-red-100 bg-red-50/10" : 
                                      item.status === 'Conforme' ? "border-green-100 bg-green-50/10" : "border-slate-100"
                                    )}>
                                      <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-slate-700">{item.nome}</span>
                                        <span className={cn(
                                          "text-[9px] font-black p-1 px-2 rounded-md uppercase tracking-wider",
                                          item.status === 'Conforme' ? "bg-green-100 text-green-800" :
                                          item.status === 'Não conforme' ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"
                                        )}>
                                          {item.status}
                                        </span>
                                      </div>
                                      {item.status === 'Não conforme' && item.observacao && (
                                        <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg font-medium border border-red-100/50 mt-1">
                                          <strong>Obs:</strong> {item.observacao}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-red-50/30 border border-red-100 p-5 rounded-2xl">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest">Motivo da Não Realização</p>
                                  <p className="text-sm font-semibold text-slate-700 mt-2 italic bg-white border border-red-100 p-4 rounded-xl shadow-sm">
                                    "{visit.motivoNaoRealizacao || 'Sem justificativa preenchida.'}"
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {visit.realizado === true && (
                            <div className="p-6 space-y-8 animate-in slide-in-from-top-2 duration-300">
                              {/* Location and Photo Evidence */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
                                <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4">
                                  <div className="w-12 h-12 bg-brand-50 text-brand-900 rounded-lg flex items-center justify-center shrink-0">
                                    <MapPin className="w-6 h-6" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coordenadas GPS</p>
                                    <p className="text-xs font-mono text-slate-600 truncate">
                                      {visit.latitude ? `${visit.latitude.toFixed(6)}, ${visit.longitude?.toFixed(6)}` : 'Não capturado'}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4 relative group">
                                  <div className="w-12 h-12 bg-brand-50 text-brand-900 rounded-lg flex items-center justify-center shrink-0">
                                    <Camera className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto do Comprovante</p>
                                    <p className="text-xs text-slate-600">Imagem capturada no local</p>
                                  </div>
                                  {visit.fotos?.[0] && (
                                    <img 
                                      src={visit.fotos[0]} 
                                      alt="Evidência" 
                                      className="w-12 h-12 rounded-lg object-cover border border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                      onClick={() => window.open(visit.fotos[0], '_blank')}
                                    />
                                  )}
                                </div>
                              </div>

                              <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <FormField label="Horário da Visita" type="time" value={visit.horario} onChange={(e) => updateVisit(visit.id, { horario: e.target.value })} />
                                  <div className="space-y-2">
                                    <SearchableSelect 
                                      label="Adicionar Vigilante Presente" 
                                      placeholder="Pesquisar vigilante..."
                                      value=""
                                      onChange={(val) => addVigilanteToVisit(visit.id, val)}
                                      options={vigilantes.map(v => ({ id: v.id, label: v.nome, subLabel: v.matricula }))}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {visit.vigilantesPresentes?.map(vp => (
                                        <div key={vp.id} className="bg-brand-50 text-brand-900 px-3 py-1.5 rounded-lg border border-brand-100 flex items-center gap-2 animate-in zoom-in duration-200">
                                          <span className="text-[10px] font-black uppercase tracking-tight">{vp.nome}</span>
                                          <button 
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              removeVigilanteFromVisit(visit.id, vp.id);
                                            }}
                                            className="hover:text-red-500 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                      {(!visit.vigilantesPresentes || visit.vigilantesPresentes.length === 0) && (
                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest italic p-1">Nenhum vigilante informado</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  <ListChecks className="w-4 h-4" /> Verificação de Checklist
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                  {visit.checklist.map((item) => (
                                    <div key={item.itemId} className={cn(
                                      "p-4 rounded-xl border transition-all",
                                      item.status === 'Não conforme' ? "bg-red-50/50 border-red-100" : 
                                      item.status === 'Conforme' ? "bg-green-50/50 border-green-100" : "bg-slate-50 border-slate-100"
                                    )}>
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <span className={cn(
                                          "text-sm font-bold",
                                          item.status === 'Não conforme' ? "text-red-700" : 
                                          item.status === 'Conforme' ? "text-green-700" : "text-slate-700"
                                        )}>
                                          {item.nome}
                                        </span>
                                        <div className="flex flex-wrap sm:flex-nowrap bg-white p-0.5 sm:p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto overflow-hidden">
                                          {['Conforme', 'Não conforme', 'Não verificado'].map(s => (
                                            <button
                                              key={s}
                                              type="button"
                                              onClick={() => updateChecklist(visit.id, item.itemId, { status: s as any })}
                                              className={cn(
                                                "px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-all flex-1 text-center truncate",
                                                item.status === s ? 
                                                  (s === 'Conforme' ? "bg-green-500 text-white shadow-sm" : 
                                                   s === 'Não conforme' ? "bg-red-500 text-white shadow-sm" : "bg-slate-500 text-white shadow-sm") : 
                                                  "text-slate-400 hover:text-slate-600"
                                              )}
                                            >
                                              {s === 'Não verificado' ? 'Não verif.' : s}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {item.status === 'Não conforme' && (
                                        <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                                          <textarea 
                                            placeholder="Observação obrigatória para não conformidade..." 
                                            className="w-full p-4 text-sm bg-white border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all shadow-sm"
                                            value={item.observacao || ''}
                                            required
                                            onChange={(e) => updateChecklist(visit.id, item.itemId, { observacao: e.target.value })}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Action Footer: OK button */}
                              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                  <span>Adicione vigilantes e responda a todo o checklist para liberar a conclusão.</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={!canFinalizeChecklist}
                                  onClick={() => updateVisit(visit.id, { finalizado: true })}
                                  className={cn(
                                    "px-6 py-3 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center outline-none",
                                    canFinalizeChecklist 
                                      ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer" 
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  )}
                                >
                                  <Check className="w-4 h-4" /> Concluir e Fechar Posto
                                </button>
                              </div>
                            </div>
                          )}

                          {visit.realizado === false && (
                            <div className="p-6 bg-slate-50/50 animate-in slide-in-from-top-2 duration-300 space-y-4">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Motivo da Não Realização</label>
                                <textarea 
                                  placeholder="Descreva o motivo pelo qual este posto não pôde ser fiscalizado..." 
                                  className="w-full p-4 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all shadow-sm"
                                  value={visit.motivoNaoRealizacao || ''}
                                  required
                                  onChange={(e) => updateVisit(visit.id, { motivoNaoRealizacao: e.target.value })}
                                />
                              </div>
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
                                <div className="flex items-center gap-2 text-red-600">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <p className="text-[10px] font-bold uppercase tracking-wider">Por favor, descreva o motivo antes de confirmar.</p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => updateVisit(visit.id, { realizado: undefined, motivoNaoRealizacao: '' })}
                                    className="px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-xl transition-all w-full sm:w-auto outline-none transition-transform"
                                  >
                                    Voltar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canFinalizeSkipped}
                                    onClick={() => updateVisit(visit.id, { finalizado: true })}
                                    className={cn(
                                      "px-6 py-3 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center outline-none",
                                      canFinalizeSkipped 
                                        ? "bg-red-500 hover:bg-red-600 text-white cursor-pointer" 
                                        : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                    )}
                                  >
                                    <Check className="w-4 h-4" /> Concluir Não Realização
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {formData.postosVisitados.length === 0 && (
                  <div className="p-20 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-300 text-center">
                    <MapPin className="w-12 h-12 mb-4 opacity-10" />
                    <p className="font-medium text-slate-400">Nenhum posto agendado para fiscalização hoje.</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest mt-2">Verifique as configurações do posto</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <FormField 
                  label="Observações Gerais do Plantão" 
                  as="textarea" 
                  rows={6} 
                  value={formData.observacoesGerais} 
                  onChange={(e) => setFormData({...formData, observacoesGerais: e.target.value})} 
                  placeholder="Descreva os fatos relevantes ocorridos durante o plantão..." 
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3">
          <Button 
            variant="secondary" 
            icon={ChevronLeft} 
            onClick={prevStep}
            disabled={currentStep === 1 || isSaving}
            className="h-10 text-xs px-3 sm:px-5 shrink-0"
          >
            Anterior
          </Button>

          <div className="flex items-center gap-3 sm:gap-6">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
              <span className="hidden xs:inline">Etapa </span>{currentStep} / {STEPS.length}
            </span>
            {currentStep < STEPS.length ? (
              <Button 
                onClick={nextStep}
                disabled={currentStep === 1 && hasSubmittedToday}
                className="group pl-4 pr-3 sm:pl-6 sm:pr-5 py-2.5 h-10 text-xs shrink-0"
              >
                <span className="hidden xs:inline">Próxima Etapa</span>
                <span className="xs:hidden">Próxima</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 sm:ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            ) : (
              <Button 
                onClick={handleFinalize}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 px-5 sm:px-10 shadow-lg shadow-green-600/20 h-10 text-xs shrink-0"
              >
                {isSaving ? 'Salvando...' : 'Finalizar'}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden file input for camera */}
      <input 
        type="file" 
        ref={fileInputRef}
        className="hidden" 
        accept="image/*" 
        capture="environment"
        onChange={handlePhotoCapture}
      />
    </div>
  );
}
