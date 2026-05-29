export type UserRole = "Admin" | "Supervisor" | "Operacional" | "Consulta";

export enum FuncaoVigilante {
  Vigilante = "Vigilante",
  Volante = "Volante",
  Intermitente = "Intermitente",
  Reserva = "Reserva",
  Supervisor = "Supervisor"
}

export enum StatusVigilante {
  Ativo = "Ativo",
  Ferias = "Férias",
  Afastado = "Afastado",
  Demitido = "Demitido",
  DesligadoPendente = "Desligado (Pendente)"
}

export interface Vigilante {
  id: string;
  nome: string;
  matricula?: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  postoFixoId?: string;
  funcao: FuncaoVigilante;
  escala?: string;
  situacao: StatusVigilante;
  armado: boolean;
  admissao?: string;
  cnv?: string;
  vencimentoCnv?: string;
  observacoes?: string;
  fotoUrl?: string;
  createdAt?: string;
}

export interface Supervisor {
  id: string;
  nome: string;
  matricula?: string;
  telefone?: string;
  email?: string;
  regiao?: string;
  status: "Ativo" | "Inativo";
}

export interface Posto {
  id: string;
  nome: string;
  cliente?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  qtdVigilantes?: number;
  escala?: string;
  supervisorId?: string;
  observacoes?: string;
  status: "Ativo" | "Inativo";
  armado: boolean;
  checklistItemIds?: string[];
  viagem?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ChecklistItem {
  id: string;
  nome: string;
  aplicacao: "Armado" | "Desarmado" | "Ambos";
  status: "Ativo" | "Inativo";
  createdAt?: string;
}

export type OcorrenciaPrioridade = "Baixa" | "Média" | "Alta" | "Crítica";
export type OcorrenciaStatus = "Pendente" | "Finalizada" | "Aprovada";

export interface ChecklistVerificacao {
  itemId: string;
  nome: string; // denormalized for reports
  status: "Conforme" | "Não conforme" | "Não verificado";
  observacao?: string;
  fotoUrl?: string;
  acaoTomada?: string;
}

export interface PostoVisitado {
  id: string;
  postoId: string;
  nomePosto: string; // denormalized
  horario: string;
  situacao: string;
  vigilantesPresentes: { id: string; nome: string }[];
  observacoes?: string;
  fotos: string[];
  latitude?: number;
  longitude?: number;
  checklist: ChecklistVerificacao[];
  realizado?: boolean;
  motivoNaoRealizacao?: string;
  finalizado?: boolean;
  doRoteiro?: boolean;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  username?: string; // used for matricula/login
  matricula?: string;
  photoURL: string | null;
  role: UserRole;
}

export interface Ocorrencia {
  id: string;
  data: string;
  hora: string;
  turno: "Diurno" | "Noturno" | "Viagem";
  supervisorId: string;
  nomeSupervisor: string; // denormalized
  tipo: string;
  prioridade: OcorrenciaPrioridade;
  status: OcorrenciaStatus;
  
  // Vigilante faltoso details
  vigilanteFaltosoId?: string;
  postoFaltaId?: string;
  escalaFalta?: string;
  horarioFalta?: string;
  motivoFalta?: string;
  
  // Cobertura details
  vigilanteCoberturaId?: string;
  tipoCobertura?: string;
  entradaCobertura?: string;
  saidaCobertura?: string;
  observacoesCobertura?: string;
  
  postosVisitados: PostoVisitado[];
  observacoesGerais: string;
  anexos: string[];
  assinaturaUrl?: string;
  
  createdBy: string;
  createdAt: any; // Firestore Timestamp
}

export interface Transferencia {
  id: string;
  vigilanteSaindoId: string;
  nomeVigilanteSaindo: string;
  postoOrigemId: string;
  nomePostoOrigem: string;
  vigilanteEntrandoId: string;
  nomeVigilanteEntrando: string;
  postoDestinoId: string;
  nomePostoDestino: string;
  dataTransferencia: string;
  motivo: string;
  status: 'Pendente' | 'Realizada';
  supervisorId: string;
  nomeSupervisor: string;
  horarioTurno?: string;
  createdAt: any;
}

export interface Roteiro {
  id: string;
  nome: string;
  diaSemana: string; // 'Segunda', 'Terça', etc.
  turno: "Diurno" | "Noturno" | "Viagem";
  postos: { id: string; nome: string }[];
  status: "Ativo" | "Inativo";
  createdAt: any;
}
