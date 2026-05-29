import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  deleteField,
  enableIndexedDbPersistence,
  initializeFirestore,
  addDoc,
  serverTimestamp,
  getDocsFromCache,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Log config existence (debug only, keys are public in this context)
console.log("[Firebase] Config loaded:", !!firebaseConfig.projectId);

// Initialize Firebase
let app;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
} catch (error) {
  console.error("[Firebase] Initialization error:", error);
  throw error;
}

// Initialize Firestore
const config = firebaseConfig as any;
export const db = config.firestoreDatabaseId 
  ? getFirestore(app, config.firestoreDatabaseId) 
  : getFirestore(app);

// Activating offline persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore] Persistence failed: Multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore] Persistence failed: Browser lacks support.');
    } else {
      console.warn('[Firestore] Persistence failed error:', err);
    }
  });
} catch (e) {
  console.warn('[Firestore] Failed to invoke enableIndexedDbPersistence:', e);
}

export { serverTimestamp };

const raceWithTimeout = <T>(promise: Promise<T>, fallbackValue: any, timeoutMs = 600): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    let completed = false;
    
    promise.then(
      (val) => {
        if (!completed) {
          completed = true;
          resolve(val);
        }
      },
      (err) => {
        if (!completed) {
          completed = true;
          reject(err);
        }
      }
    );
    
    setTimeout(() => {
      if (!completed) {
        completed = true;
        console.warn(`[Firestore] Timeout waiting for server response - resolving optimistically.`);
        resolve(fallbackValue as T);
      }
    }, timeoutMs);
  });
};

function sanitizeForLocal(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle Firestore FieldValue / serverTimestamp
  if (obj.constructor && (
    obj.constructor.name === 'FieldValue' || 
    obj.constructor.name === 'FieldValueImpl' ||
    typeof obj._methodName === 'string'
  )) {
    return new Date().toISOString();
  }

  // Handle Firebase Timestamps or Dates
  if (obj.toDate && typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }
  
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') {
    return new Date(obj.seconds * 1000).toISOString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLocal);
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object') {
      if (value.constructor && (
        value.constructor.name === 'FieldValue' || 
        value.constructor.name === 'FieldValueImpl' ||
        typeof value._methodName === 'string'
      )) {
        result[key] = new Date().toISOString();
      } else if (value.toDate && typeof value.toDate === 'function') {
        result[key] = value.toDate().toISOString();
      } else if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        result[key] = new Date(value.seconds * 1000).toISOString();
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else {
        result[key] = sanitizeForLocal(value);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

const DEFAULT_STORE: Record<string, any[]> = {
  users: [
    { uid: 'u1', matricula: 'roberto', displayName: 'Roberto', role: 'Supervisor', password: '1234' },
    { uid: 'u2', matricula: 'aloir', displayName: 'Aloir', role: 'Supervisor', password: '1234' },
    { uid: 'u3', matricula: 'cleito', displayName: 'Cleito', role: 'Admin', password: '1234' },
    { uid: 'u4', matricula: 'arthur', displayName: 'Arthur', role: 'Admin', password: '1234' },
    { uid: 'u5', matricula: 'luiz henrique', displayName: 'Luiz Henrique', role: 'Supervisor', password: '1234' },
    { uid: 'u6', matricula: 'reinaldo', displayName: 'Reinaldo', role: 'Supervisor', password: '1234' },
    { uid: 'u7', matricula: 'marcio', displayName: 'Márcio', role: 'Supervisor', password: '1234' },
    { uid: 'u8', matricula: 'arthursouza1106@gmail.com', displayName: 'Arthur Souza', role: 'Admin', password: '1234' }
  ],
  postos: [
    { id: 'p1', nome: 'Shopping Central (Armado)', status: 'Ativo', armado: true, supervisorId: 'u1', checklistItemIds: ['c1', 'c2', 'c3', 'c4', 'c5'] },
    { id: 'p2', nome: 'Condomínio Solar', status: 'Ativo', armado: false, supervisorId: 'u2', checklistItemIds: ['c1', 'c2', 'c5', 'c6'] },
    { id: 'p3', nome: 'Indústria Metalúrgica (Armado)', status: 'Ativo', armado: true, supervisorId: 'u4', checklistItemIds: ['c1', 'c2', 'c3', 'c4', 'c5'] },
    { id: 'p4', nome: 'Hospital São Luiz', status: 'Ativo', armado: false, supervisorId: 'u5', checklistItemIds: ['c1', 'c2', 'c5', 'c6'] },
    { id: 'p5', nome: 'Supermercado Todo Dia', status: 'Ativo', armado: false, supervisorId: 'u6', checklistItemIds: ['c1', 'c2', 'c5'] }
  ],
  checklistItems: [
    { id: 'c1', nome: 'Livro de ocorrência preenchido?', aplicacao: 'Ambos', status: 'Ativo' },
    { id: 'c2', nome: 'Uniforme e apresentação pessoal?', aplicacao: 'Ambos', status: 'Ativo' },
    { id: 'c3', nome: 'Vigilante com armamento e munição?', aplicacao: 'Armado', status: 'Ativo' },
    { id: 'c4', nome: 'Colete balístico dentro do prazo?', aplicacao: 'Armado', status: 'Ativo' },
    { id: 'c5', nome: 'Rádio ou celular de apoio carregado?', aplicacao: 'Ambos', status: 'Ativo' },
    { id: 'c6', nome: 'Portão e controle de acesso funcionando?', aplicacao: 'Desarmado', status: 'Ativo' }
  ],
  vigilantes: [
    { id: 'v1', nome: 'João Silva', matricula: 'V001', cpf: '111.111.111-11', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p1', escala: '12x36' },
    { id: 'v2', nome: 'Maria Oliveira', matricula: 'V002', cpf: '222.222.222-22', funcao: 'Supervisor', status: 'Ativo', postoFixoId: 'p2', escala: '5x2' },
    { id: 'v3', nome: 'Carlos Santos', matricula: 'V003', cpf: '333.333.333-33', funcao: 'Volante', status: 'Ativo', escala: '12x36' },
    { id: 'v4', nome: 'Ana Costa', matricula: 'V004', cpf: '444.444.444-44', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p3', escala: '12x36' },
    { id: 'v5', nome: 'Pedro Rocha', matricula: 'V005', cpf: '555.555.555-55', funcao: 'Intermitente', status: 'Ativo', escala: 'Intermitente' },
    { id: 'v6', nome: 'Lucas Mendes', matricula: 'V006', cpf: '666.666.666-66', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p4', escala: '12x36' },
    { id: 'v7', nome: 'Fernanda Lima', matricula: 'V007', cpf: '777.777.777-77', funcao: 'Almoxarife', status: 'Ativo', escala: '5x2' },
    { id: 'v8', nome: 'Roberto Alves', matricula: 'V008', cpf: '888.888.888-88', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p5', escala: '12x36' }
  ],
  motivos_falta: [
    { id: "Qs9BAB1TKfJmgtsTImmj", nome: "CONTRATO SUSPENSO " },
    { id: "SRa11Lg8rZMI1FA6PQ4y", nome: "XXX" },
    { id: "WQ6du0WgJ33hDDK7UxcN", nome: "COMPENSANDO BANCO DE HORAS" },
    { id: "YFXKySK38KeoSRUwjKkZ", nome: "COBRINDO AFASTAMENTO" },
    { id: "ZOqVLFIn1R7oqVFJObDi", nome: "LICENÇA PATERNIDADE " },
    { id: "ZaWJY7cNnvTIWurxRYR8", nome: "DESLIGADO" },
    { id: "ZewIGYWhx8G1UKWtOPcK", nome: "SOLICITAÇÃO DA GERÊNCIA " },
    { id: "awlNgSVqAiVYl4Oq8uL5", nome: "TREINAMENTO" },
    { id: "bpXtzNM6MqVd0Mca24ov", nome: "TRANSFERIDO" },
    { id: "cf9r5cF7noPT8AvlM8QN", nome: "PONTO FACULTATIVO " },
    { id: "d6nUgzaSHlwmZeatSfLF", nome: "ATESTADO" },
    { id: "dWmkMxNqNM2doz6oEx78", nome: "LUTO" },
    { id: "eX4PzjXcdckEpQzsAr9z", nome: "RECICLAGEM" },
    { id: "itDBvcVb47gfUKrbVAIS", nome: "SUSPENSÃO" },
    { id: "m1", nome: "FALTA", status: "Ativo" },
    { id: "oq6OU7ZdykAjGfY3f443", nome: "LICENÇA MATERNIDADE" },
    { id: "rSMcASiTl3iS16msOwLQ", nome: "FÉRIAS" },
    { id: "sowSPa93lDwGkpveOafx", nome: "LICENÇA CASAMENTO " },
    { id: "xrFlxz8lW5SWNc9lO8FF", nome: "INSS" }
  ],
  tipos_cobertura: [
    { id: "UGE3SvtUxkWPrnJEVWiK", nome: "HORISTA" },
    { id: "l8HffqKlMU6gIQukwCpD", nome: "XXX" },
    { id: "r2JCWrzFDQ694G9qLiwc", nome: "SUPERVISOR" },
    { id: "tc1", status: "Ativo", nome: "INTERMITENTE" },
    { id: "tc2", nome: "BANCO DE HORAS", status: "Ativo" },
    { id: "tc3", nome: "HORA EXTRA", status: "Ativo" },
    { id: "tc4", status: "Ativo", nome: "VOLANTE" }
  ],
  viaturas: [
    { id: 'vt1', placa: 'BRA2E19' },
    { id: 'vt2', placa: 'GUA4F22' },
    { id: 'vt3', placa: 'ROTA999' }
  ],
  roteiros: [
    {
      id: "4UOoy1rFBKe4OhW6jB56",
      postos: [
        { nome: "MUNIC FPOLIS SME-EBM DONÍCIA M DA COSTA", id: "ybQTBNM0J2j5LN5sJWKi" },
        { nome: "MUNIC FPOLIS SME-NEIM VILA CACHOEIRA", id: "tdzMfmzQ29aoPbAMImUn" },
        { nome: "MUNIC FPOLIS SME-EBM LUIZ C DA LUZ", id: "waO3JX2V3v66ih2yBFD1" },
        { nome: "MUNIC FPOLIS SME-NEIM VILA UNIÃO", id: "n7i5w05CvXlMmL1du8Oh" },
        { nome: "MUNIC FPOLIS SME-EBM DARCY RIBEIRO", id: "RvTXLqcmbM1p4uOaPMSC" },
        { nome: "MUNIC FPOLIS SME-EBM MARIA CONCEIÇÃO NUNES", id: "wD60NhAiP5J6UptDYeND" },
        { nome: "MUNIC FPOLIS SME-NEIM RED PARK", id: "9TUYy8QRp7oGNeAZIclE" },
        { nome: "MUNIC FPOLIS SME-EBM HERONDINA M ZEFERINO", id: "ZSYYNVMMi2AKp6m0mRtC" },
        { nome: "MUNIC FPOLIS SME-NEIM GENTIL M DA SILVA", id: "QDh34PoiHvxyq0vonsYv" },
        { nome: "MUNIC FPOLIS SME-NEIM INGLESES I", id: "wTfUO4vc8sx6tqotRwiZ" },
        { nome: "MUNIC FPOLIS SME-EBM VIRGÍLIO DOS R VARZEA", id: "mrbmU4ngJ2ipmU7lQ4BL" },
        { nome: "MUNIC FPOLIS SME-EBM OSMAR CUNHA", id: "zKSCbuBun1VaAsNwBxgV" }
      ],
      status: "Ativo",
      nome: "TERÇA FEIRA - DIURNO ",
      diaSemana: "Terça-feira",
      turno: "Diurno"
    },
    {
      id: "6lrkM07d9M2k2oqZwyK9",
      postos: [
        { nome: "SES-IPQ INST DE PSIQ", id: "iQlG3Az7kSCLVHNU4NUj" },
        { nome: "SES-HOSP SANTA TEREZA", id: "14VUoKh0NgdyuKCFmxHc" },
        { nome: "PREF S PEDRO ALCANTERA-CEI FREI ATICO", id: "qlANX1ZrL64HmSYiXxmQ" },
        { nome: "PREF S PEDRO ALCANTERA-EBM A.T.DE CARVALHO", id: "HHmrrOrC3vs8rili12ZB" },
        { nome: "PREF S PEDRO ALCANTERA-CEI PRF L.V. FRANCENER", id: "gClnLgU9wiC6lS7fuVNA" },
        { nome: "PREF S PEDRO ALCANTERA-EBM STA FILOMENA", id: "cJmE0xMu9C9eINAxMYma" }
      ],
      status: "Ativo",
      nome: "SEXTA FEIRA - DIURNO ",
      turno: "Diurno",
      diaSemana: "Sexta-feira"
    },
    {
      id: "8Jo9GDEuZiEP6MocLS5s",
      nome: "DOMINGO - DIURNO ",
      turno: "Diurno",
      diaSemana: "Domingo",
      postos: [
        { nome: "SES-HOSP REG HOMERO", id: "fBJXgQRthpfvHSvNwUAj" },
        { nome: "SES-INST DE CARDIOLOGIA", id: "hMo3JVqw8bPgAoNBLuFi" },
        { nome: "SES-GEPAT", id: "ArzEA3mwXYiC9lR3IsDc" },
        { nome: "IFSC PALHOÇA", id: "CHqSgHe3a7Lux9ERjiyY" },
        { nome: "SECRET EST DES SOCIAL-PALHOÇA", id: "ClwZWZ3sk39U1SzqMcY0" },
        { nome: "SENAC-PALHOÇA", id: "HDcMdvdgz5rT9Jspv3s0" },
        { nome: "SES-DIRET VIG EPIDEM", id: "9cZBUPUy91STnaIilU00" }
      ],
      status: "Ativo"
    },
    {
      id: "BxlEvebXHgcvGsM26Fwe",
      postos: [
        { nome: "SES-CENTRO CAT DE RE", id: "N7oWDXGNYX3cC1PvkdSO" },
        { nome: "SES-HOSP INF JOANA GUSMAO", id: "xHx0fXs4lTZi8X9NXnT4" },
        { nome: "SES-HOSP NEREU RAMOS", id: "EaA1RrSfjGuldSLNKxaH" },
        { nome: "SES-INST ANATOMIA PATOLOGICA", id: "FXBUAJ07nWgAAwvbRX3R" },
        { nome: "MUNIC FPOLIS SME-EBM DONÍCIA M DA COSTA", id: "ybQTBNM0J2j5LN5sJWKi" },
        { nome: "MUNIC FPOLIS SME-EBM LUIZ C DA LUZ", id: "waO3JX2V3v66ih2yBFD1" },
        { nome: "MUNIC FPOLIS SME-EBM HERONDINA M ZEFERINO", id: "ZSYYNVMMi2AKp6m0mRtC" },
        { nome: "MUNIC FPOLIS SME-EBM VIRGÍLIO DOS R VARZEA", id: "mrbmU4ngJ2ipmU7lQ4BL" }
      ],
      status: "Ativo",
      nome: "TERÇA FEIRA - NOTURNO ",
      turno: "Noturno",
      diaSemana: "Terça-feira"
    },
    {
      id: "EPbk1UaAUplvqDp58miL",
      status: "Ativo",
      postos: [
        { nome: "FUNDACENTRO FPOLIS", id: "5SYZsj6ZPJSg03U8DyW9" },
        { nome: "MUNIC FPOLIS SME-NEIM ALM LUCAS A BOITEUX", id: "T9u1Fh7Ks8M8hsExXjqt" },
        { nome: "ANATEL", id: "b2h92NsA4yBlVSdSWuC6" },
        { nome: "CECOMTUR", id: "Gjp3NSM01pt8LMj6EJ0U" },
        { nome: "SES-ADM CENTRAL HAL", id: "5AQEpcCB5HYtKMHFZlDr" },
        { nome: "MUNIC FPOLIS SME-SEDE ESTEVES JÚNIOR", id: "bYAIEElDuEeB0ko5EPHB" },
        { nome: "SES-SUR SUPERINT DE SERV ESP", id: "QWfp7PqO7yL5Lp1z384u" },
        { nome: "DEFENSORIA UNIAO-FPOLIS", id: "I0SdtgXoABr5BIAfKBaG" },
        { nome: "SES-LACEN LAB CENTRAL", id: "nXWFRwMcQhsxne51ABGy" },
        { nome: "SES-DIRET VIG SANITARIA", id: "K1m5vGizvdQkUGjXfXYk" },
        { nome: "Junta Comercial de SC - Jucesc", id: "GOE8Ydz3Q4wDgVZl4sQQ" },
        { nome: "SES-MAT CARMELA DUTRA", id: "aRdrfEeG7NKDOkwOcNtv" },
        { nome: "SES-HOSP GOV CELSO RAMOS", id: "VxTrHvf0igVNxHnOSf14" },
        { nome: "MUNIC FPOLIS SME-NEIM MORRO DO MOCOTÓ", id: "BvvojwaXsrz4GNKjXlnH" },
        { nome: "MUNIC FPOLIS SME-EBM PADRE ROMA", id: "bzztidj8v7vURrfNDPIH" }
      ],
      diaSemana: "Quinta-feira",
      turno: "Diurno",
      nome: "QUINTA FEIRA - DIURNO"
    },
    {
      id: "MkgwEGgTZgNoV3v6CW3x",
      postos: [
        { nome: "ANATEL", id: "b2h92NsA4yBlVSdSWuC6" },
        { nome: "CECOMTUR", id: "Gjp3NSM01pt8LMj6EJ0U" },
        { nome: "SES-HOSP REG HOMERO", id: "fBJXgQRthpfvHSvNwUAj" },
        { nome: "SES-INST DE CARDIOLOGIA", id: "hMo3JVqw8bPgAoNBLuFi" },
        { nome: "SES-GEPAT", id: "ArzEA3mwXYiC9lR3IsDc" },
        { nome: "IFSC PALHOÇA", id: "CHqSgHe3a7Lux9ERjiyY" },
        { nome: "SECRET EST DES SOCIAL-PALHOÇA", id: "ClwZWZ3sk39U1SzqMcY0" },
        { nome: "SES-DIRET VIG EPIDEM", id: "9cZBUPUy91STnaIilU00" }
      ],
      status: "Ativo",
      nome: "DOMINGO - NOTURNO ",
      turno: "Noturno",
      diaSemana: "Domingo"
    },
    {
      id: "QaRgAXHNW6Wb9erHYia8",
      nome: "SEXTA FEIRA - NOTURNO ",
      diaSemana: "Sexta-feira",
      turno: "Noturno",
      postos: [
        { nome: "MUNIC FPOLIS SME-NEIM CHICO MENDES", id: "uLVpBhDr2eVRzCq1sfZ1" },
        { nome: "MUNIC FPOLIS SME-NEIM MATEUS DE BARROS", id: "Pb5YfJUzThGXDkwWjfEw" },
        { nome: "MUNIC FPOLIS SME-NEIM MARIA BARREIROS", id: "J4JWg5RlEUOGLmSOAoBW" },
        { nome: "SECRET EST DES SOCIAL-FPOLIS", id: "xhgiU0YE2dVckkJ17U7H" },
        { nome: "FUNDACENTRO FPOLIS", id: "5SYZsj6ZPJSg03U8DyW9" },
        { nome: "CECOMTUR", id: "Gjp3NSM01pt8LMj6EJ0U" },
        { nome: "SES-HOSP GOV CELSO RAMOS", id: "VxTrHvf0igVNxHnOSf14" },
        { nome: "SES-MAT CARMELA DUTRA", id: "aRdrfEeG7NKDOkwOcNtv" },
        { nome: "SES-18a Ger de Saude", id: "6bZ5NqtGb6iT4z9NitWJ" },
        { nome: "SES-EFHOS BARREIROS", id: "gqIjrCWKGzrb2AKYh84Z" }
      ],
      status: "Ativo"
    },
    {
      id: "S02yW1lvX9TTIsDhLKBz",
      nome: "SEGUNDA FEIRA - NOTURNO ",
      diaSemana: "Segunda-feira",
      turno: "Noturno",
      postos: [
        { nome: "MUNIC FPOLIS SME-NEIM MORRO DO MOCOTÓ", id: "BvvojwaXsrz4GNKjXlnH" },
        { nome: "MUNIC FPOLIS SME-NEIM HASSIS", id: "xVQ8hFihUIqF6o64jFwz" },
        { nome: "MUNIC FPOLIS SME-EBM JOÃO G PINHEIRO", id: "p0ZoBdxFb6p8eRwIOrjE" },
        { nome: "MUNIC FPOLIS SME-EBM PADRE ROMA", id: "bzztidj8v7vURrfNDPIH" },
        { nome: "SES-HOSP GOV CELSO RAMOS", id: "VxTrHvf0igVNxHnOSf14" },
        { nome: "SES-MAT CARMELA DUTRA", id: "aRdrfEeG7NKDOkwOcNtv" },
        { nome: "SES-LACEN LAB CENTRAL", id: "nXWFRwMcQhsxne51ABGy" },
        { nome: "SES-DIRET VIG SANITARIA", id: "K1m5vGizvdQkUGjXfXYk" }
      ],
      status: "Ativo"
    },
    {
      id: "Sa84rF9g9gxUFWfhgDNU",
      turno: "Diurno",
      diaSemana: "Sábado",
      nome: "SÁBADO - DIURNO ",
      status: "Ativo",
      postos: [
        { nome: "MUNIC FPOLIS SME-NEIM ILHA CONTINENTE", id: "4rXcnbBj6c2zise9Rycf" },
        { nome: "MUNIC FPOLIS SME-EBM ALMIRANTE CARVALHAL", id: "AdyIsKqnFVyJqmULrvEQ" },
        { nome: "MUNIC FPOLIS SME-NEIM DONA COTA", id: "I5xLz8gKG2pHeHT9nqLu" },
        { nome: "MUNIC FPOLIS SME-NEIM JOEL R DE FREITAS", id: "KHVm3gNmJo3Kq9xpZY4K" },
        { nome: "MUNIC FPOLIS SME-NEIM CHICO MENDES", id: "uLVpBhDr2eVRzCq1sfZ1" },
        { nome: "MUNIC FPOLIS SME-NEIM MATEUS DE BARROS", id: "Pb5YfJUzThGXDkwWjfEw" },
        { nome: "MUNIC FPOLIS SME-NEIM MARIA BARREIROS", id: "J4JWg5RlEUOGLmSOAoBW" },
        { nome: "SECRET EST DES SOCIAL-FPOLIS", id: "xhgiU0YE2dVckkJ17U7H" },
        { nome: "MUNIC FPOLIS SME-NEIM JULIA M RODRIGUES", id: "cES6YC6NZrAbO9E8ZXDT" },
        { nome: "SES-18a Ger de Saude", id: "6bZ5NqtGb6iT4z9NitWJ" },
        { nome: "SES-EFHOS BARREIROS", id: "gqIjrCWKGzrb2AKYh84Z" }
      ]
    },
    {
      id: "jaKbuGsD8UDKj2UZA9q4",
      nome: "QUINTA FEIRA - NOTURNO ",
      turno: "Noturno",
      diaSemana: "Quinta-feira",
      postos: [
        { nome: "FUNDACENTRO FPOLIS", id: "5SYZsj6ZPJSg03U8DyW9" },
        { nome: "ANATEL", id: "b2h92NsA4yBlVSdSWuC6" },
        { nome: "CECOMTUR", id: "Gjp3NSM01pt8LMj6EJ0U" },
        { nome: "SES-ADM CENTRAL HAL", id: "5AQEpcCB5HYtKMHFZlDr" },
        { nome: "MUNIC FPOLIS SME-SEDE ESTEVES JÚNIOR", id: "bYAIEElDuEeB0ko5EPHB" },
        { nome: "SES-SUR SUPERINT DE SERV ESP", id: "QWfp7PqO7yL5Lp1z384u" },
        { nome: "SES-LACEN LAB CENTRAL", id: "nXWFRwMcQhsxne51ABGy" },
        { nome: "SES-DIRET VIG SANITARIA", id: "K1m5vGizvdQkUGjXfXYk" },
        { nome: "Junta Comercial de SC - Jucesc", id: "GOE8Ydz3Q4wDgVZl4sQQ" },
        { nome: "SES-MAT CARMELA DUTRA", id: "aRdrfEeG7NKDOkwOcNtv" },
        { nome: "SES-HOSP GOV CELSO RAMOS", id: "VxTrHvf0igVNxHnOSf14" }
      ],
      status: "Ativo"
    },
    {
      id: "nhN7VKxNXRWoCicdZLuJ",
      turno: "Diurno",
      diaSemana: "Segunda-feira",
      nome: "SEGUNDA-FEIRA - DIURNO",
      status: "Ativo",
      postos: [
        { nome: "MUNIC FPOLIS SME-NEIM HASSIS", id: "xVQ8hFihUIqF6o64jFwz" },
        { nome: "MUNIC FPOLIS SME-EBM ADOTIVA L VALENTIM", id: "J0uGHdL4oLZzGylUeMZB" },
        { nome: "MUNIC FPOLIS SME-EBM JOSÉ AMARO CORDEIRO", id: "JzkUwQZY6VCLxHr47qpI" },
        { nome: "MUNIC FPOLIS SME-EBM DILMA L DOS SANTOS", id: "TUGY1TAsQHplYP6MJUkx" },
        { nome: "MUNIC FPOLIS SME-EBM BATISTA PEREIRA", id: "xNcir5Jb1meeJrwkxbh6" },
        { nome: "MUNIC FPOLIS SME-EBM TAPERA-ESC DO FUTURO", id: "h5zB2DWEJbBXGY4h2SY6" },
        { nome: "MUNIC FPOLIS SME-EBM JOÃO G PINHEIRO", id: "p0ZoBdxFb6p8eRwIOrjE" }
      ]
    },
    {
      id: "vWBF7Zxv40I61OW0U1Vo",
      postos: [
        { nome: "SES-HOSP REG HOMERO", id: "fBJXgQRthpfvHSvNwUAj" },
        { nome: "SES-INST DE CARDIOLOGIA", id: "hMo3JVqw8bPgAoNBLuFi" },
        { nome: "SES-GEPAT", id: "ArzEA3mwXYiC9lR3IsDc" },
        { nome: "SES-IPQ INST DE PSIQ", id: "iQlG3Az7kSCLVHNU4NUj" },
        { nome: "SES-HOSP SANTA TEREZA", id: "14VUoKh0NgdyuKCFmxHc" },
        { nome: "SES-18a Ger de Saude", id: "6bZ5NqtGb6iT4z9NitWJ" },
        { nome: "SES-EFHOS BARREIROS", id: "gqIjrCWKGzrb2AKYh84Z" },
        { nome: "MUNIC FPOLIS SME-NEIM MARIA BARREIROS", id: "J4JWg5RlEUOGLmSOAoBW" }
      ],
      status: "Ativo",
      nome: "SÁBADO - NOTURNO ",
      diaSemana: "Sábado",
      turno: "Noturno"
    },
    {
      id: "yLVPMbiEvjQThkImETRP",
      diaSemana: "Quarta-feira",
      turno: "Diurno",
      nome: "QUARTA FEIRA - DIURNO ",
      status: "Ativo",
      postos: [
        { nome: "SES-CENTRO CAT DE RE", id: "N7oWDXGNYX3cC1PvkdSO" },
        { nome: "SES-HOSP INF JOANA GUSMAO", id: "xHx0fXs4lTZi8X9NXnT4" },
        { nome: "SES-HOSP NEREU RAMOS", id: "EaA1RrSfjGuldSLNKxaH" },
        { nome: "MUNIC FPOLIS SME-EBM OSVALDO GALUPO", id: "n6NBiPSBUYIPxDcmDWW4" },
        { nome: "EPAGRI-FPOLIS SEDE", id: "yYRbb3TztWVW2wl5Waif" },
        { nome: "MUNIC FPOLIS SME-EBM VITOR MIGUEL DE SOUZA", id: "6Q9Gr8HfYiOCqXFNO4Mw" },
        { nome: "EPAGRI-FPOIS C.TREIN", id: "miYH0MMPH1iZq4euTSMC" },
        { nome: "MUNIC FPOLIS SME-EBM ACÁCIO G SÃO THIAGO", id: "nnT06rcvjD4denJ0MCrV" },
        { nome: "MUNIC FPOLIS SME-EBM JOÃO ALFREDO ROHR", id: "wm8QWH0y2h9DhcmWPoBr" },
        { nome: "MUNIC FPOLIS SME-EBM JOSÉ JACINTO CARDOSO", id: "WmphQOKnzZe8WFlpDwko" },
        { nome: "MUNIC FPOLIS SME-EBM BEATRIZ DE S BRITO", id: "vIkOr3Ml4gXXHZphCBjR" }
      ]
    },
    {
      id: "zGoCjOQwqshiogR0MpEj",
      status: "Ativo",
      postos: [
        { nome: "SES-CENTRO CAT DE RE", id: "N7oWDXGNYX3cC1PvkdSO" },
        { nome: "SES-HOSP INF JOANA GUSMAO", id: "xHx0fXs4lTZi8X9NXnT4" },
        { nome: "SES-HOSP NEREU RAMOS", id: "EaA1RrSfjGuldSLNKxaH" },
        { nome: "SES-INST ANATOMIA PATOLOGICA", id: "FXBUAJ07nWgAAwvbRX3R" },
        { nome: "MUNIC FPOLIS SME-EBM OSVALDO GALUPO", id: "n6NBiPSBUYIPxDcmDWW4" },
        { nome: "EPAGRI-FPOLIS SEDE", id: "yYRbb3TztWVW2wl5Waif" },
        { nome: "MUNIC FPOLIS SME-EBM BEATRIZ DE S BRITO", id: "vIkOr3Ml4gXXHZphCBjR" }
      ],
      turno: "Noturno",
      diaSemana: "Quarta-feira",
      nome: "QUARTA FEIRA - NOTURNO "
    }
  ]
};

const _privateLocal = {
  get<T>(path: string): T[] {
    try {
      const data = localStorage.getItem(`vigi_db_${path}`);
      if (data === null) {
        const defaults = DEFAULT_STORE[path] || [];
        if (defaults.length > 0) {
          localStorage.setItem(`vigi_db_${path}`, JSON.stringify(defaults));
          return defaults as T[];
        }
        return [];
      }
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },
  save<T>(path: string, items: T[]): void {
    try {
      const sanitized = sanitizeForLocal(items);
      localStorage.setItem(`vigi_db_${path}`, JSON.stringify(sanitized));
    } catch (e) {
      console.error(`Error saving local storage for ${path}`, e);
    }
  },
  generateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let autoId = '';
    for (let i = 0; i < 20; i++) {
      autoId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return autoId;
  },
  addDeleted(path: string, id: string): void {
    try {
      const key = `vigi_deleted_${path}`;
      const deletedStr = localStorage.getItem(key);
      const deleted = deletedStr ? JSON.parse(deletedStr) : {};
      deleted[id] = Date.now();
      localStorage.setItem(key, JSON.stringify(deleted));
    } catch (e) {
      console.error(e);
    }
  },
  isDeleted(path: string, id: string): boolean {
    try {
      const key = `vigi_deleted_${path}`;
      const deletedStr = localStorage.getItem(key);
      if (!deletedStr) return false;
      const deleted = JSON.parse(deletedStr);
      const time = deleted[id];
      if (time && (Date.now() - time < 15000)) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },
  undelete(path: string, id: string): void {
    try {
      const key = `vigi_deleted_${path}`;
      const deletedStr = localStorage.getItem(key);
      if (!deletedStr) return;
      const deleted = JSON.parse(deletedStr);
      delete deleted[id];
      localStorage.setItem(key, JSON.stringify(deleted));
    } catch (e) {}
  },
  merge<T extends { id?: string; uid?: string; _local_last_updated?: number }>(path: string, firebaseItems: T[], localItems: T[]): T[] {
    const mergedMap = new Map<string, T>();
    
    // 1. Add firebase items if they are not marked as deleted locally
    firebaseItems.forEach(item => {
      const key = item.id || item.uid;
      if (key) {
        if (!_privateLocal.isDeleted(path, key)) {
          mergedMap.set(key, item);
        }
      }
    });
    
    // 2. Add or protect local items if they are updated within the lock period (15s)
    localItems.forEach(item => {
      const key = item.id || item.uid;
      if (key) {
        if (_privateLocal.isDeleted(path, key)) {
          mergedMap.delete(key);
          return;
        }
        
        const existing = mergedMap.get(key);
        if (item._local_last_updated && (Date.now() - item._local_last_updated < 15000)) {
          mergedMap.set(key, { ...existing, ...item });
        } else if (!existing) {
          mergedMap.set(key, item);
        }
      }
    });
    
    return Array.from(mergedMap.values());
  }
};

const _privateListeners = {
  listeners: new Map<string, Set<(data: any[]) => void>>(),
  add(path: string, callback: (data: any[]) => void) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path)!.add(callback);
  },
  remove(path: string, callback: (data: any[]) => void) {
    const set = this.listeners.get(path);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(path);
      }
    }
  },
  notify(path: string) {
    const set = this.listeners.get(path);
    if (set) {
      const data = _privateLocal.get<any>(path);
      set.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error notifying listener for ${path}`, e);
        }
      });
    }
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  let loggedInUser: any = null;
  try {
    const sessionStr = localStorage.getItem('vigiguard_session');
    if (sessionStr) {
      loggedInUser = JSON.parse(sessionStr);
    }
  } catch (e) {
    // Ignore key errors
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: loggedInUser?.uid || null,
      email: loggedInUser?.matricula || null,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };

  const errString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errString);
  throw new Error(errString);
}

export const genericService = {
  async list<T>(path: string): Promise<T[]> {
    try {
      const colRef = collection(db, path);
      
      // Try to get from Firestore offline cache first for instant UI response (0ms)
      try {
        const cacheSnapshot = await getDocsFromCache(colRef);
        if (!cacheSnapshot.empty) {
          const cachedData = cacheSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          
          // Silently trigger background server check to update cache
          getDocs(colRef).then((serverSnapshot) => {
            if (!serverSnapshot.empty) {
              const serverData = serverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
              _privateLocal.save(path, serverData);
              _privateListeners.notify(path);
            }
          }).catch((err) => {
            if (err && (err.code === 'permission-denied' || String(err).includes('permission'))) {
              handleFirestoreError(err, OperationType.LIST, path);
            }
          });
          
          return cachedData as T[];
        }
      } catch (cacheErr) {
        // Cache read failed or cache empty, proceed to fetch
      }

      const querySnapshot = await getDocs(colRef);
      if (!querySnapshot.empty) {
        const firebaseData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        _privateLocal.save(path, firebaseData);
        _privateListeners.notify(path);
        return firebaseData as T[];
      } else {
        const cached = _privateLocal.get<T>(path);
        return cached;
      }
    } catch (err: any) {
      if (err && (err.code === 'permission-denied' || String(err).includes('permission'))) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
      console.warn(`[Firestore] genericService.list failed for ${path}, falling back to cache:`, err);
      return _privateLocal.get<T>(path);
    }
  },

  subscribe<T>(path: string, callback: (data: T[]) => void) {
    const localData = _privateLocal.get<T>(path);
    if (localData && localData.length > 0) {
      callback(localData);
    }
    _privateListeners.add(path, callback as (data: any[]) => void);

    try {
      const q = query(collection(db, path));
      const unsub = onSnapshot(q, (snapshot) => {
        const firebaseData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        _privateLocal.save(path, firebaseData);
        _privateListeners.notify(path);
        callback(firebaseData as T[]);
      }, (error) => {
        console.error(`Error subscribing to ${path}:`, error);
        handleFirestoreError(error, OperationType.GET, path);
      });
      return () => {
        unsub();
        _privateListeners.remove(path, callback as (data: any[]) => void);
      };
    } catch (error) {
      console.error(`Fatal subscribe error for ${path}:`, error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  create<T>(path: string, data: any): Promise<T> {
    const docData = { ...data };
    const customId = docData.id || docData.uid || _privateLocal.generateId();
    docData.id = customId;
    _privateLocal.undelete(path, customId);

    const localFilterId = customId;
    const local = _privateLocal.get<any>(path);
    const newItem = { ...docData, id: customId, _local_last_updated: Date.now() };
    const updated = [...local.filter(i => (i.id || i.uid) !== localFilterId), newItem];
    _privateLocal.save(path, updated);
    _privateListeners.notify(path);

    const promise = (async () => {
      try {
        const docRef = doc(db, path, customId);
        await setDoc(docRef, sanitizeForLocal(docData));
        return newItem as T;
      } catch (err) {
        console.error(`Error writing to Firestore ${path}/${customId}:`, err);
        handleFirestoreError(err, OperationType.WRITE, `${path}/${customId}`);
      }
    })();

    return raceWithTimeout(promise, newItem as T, 1500);
  },

  update(path: string, id: string, data: any): Promise<void> {
    _privateLocal.undelete(path, id);
    const local = _privateLocal.get<any>(path);
    const updated = local.map(item => {
      if ((item.id || item.uid) === id) {
        return { ...item, ...data, _local_last_updated: Date.now() };
      }
      return item;
    });
    _privateLocal.save(path, updated);
    _privateListeners.notify(path);

    const docRef = doc(db, path, id);
    const promise = updateDoc(docRef, sanitizeForLocal(data)).catch((err) => {
      console.error(`Error updating Firestore ${path}/${id}:`, err);
      handleFirestoreError(err, OperationType.WRITE, `${path}/${id}`);
    });
    return raceWithTimeout(promise as Promise<any>, undefined, 1500);
  },

  delete(path: string, id: string): Promise<void> {
    _privateLocal.addDeleted(path, id);
    const local = _privateLocal.get<any>(path);
    const updated = local.filter(item => (item.id || item.uid) !== id);
    _privateLocal.save(path, updated);
    _privateListeners.notify(path);

    const docRef = doc(db, path, id);
    const promise = deleteDoc(docRef).catch((err) => {
      console.error(`Error deleting from Firestore ${path}/${id}:`, err);
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    });
    return raceWithTimeout(promise, undefined, 1500);
  },

  async batchSave(path: string, dataArray: any[]): Promise<void> {
    const local = _privateLocal.get<any>(path);
    const processedArray = dataArray.map(item => {
      const customId = item.id || item.uid || _privateLocal.generateId();
      _privateLocal.undelete(path, customId);
      return { ...item, id: customId, _local_last_updated: Date.now() };
    });

    const updated = [...local];
    processedArray.forEach(newItem => {
      const idx = updated.findIndex(i => (i.id || i.uid) === newItem.id);
      if (idx !== -1) {
        updated[idx] = newItem;
      } else {
        updated.push(newItem);
      }
    });
    _privateLocal.save(path, updated);
    _privateListeners.notify(path);

    try {
      const batch = writeBatch(db);
      processedArray.forEach(item => {
        const docRef = doc(db, path, item.id);
        batch.set(docRef, sanitizeForLocal(item));
      });
      const promise = batch.commit().catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
      return raceWithTimeout(promise, undefined, 3000);
    } catch (err) {
      console.error(`Error in batchSave for ${path}:`, err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  async deleteAll(path: string, ids: string[]): Promise<void> {
    ids.forEach(id => _privateLocal.addDeleted(path, id));
    const local = _privateLocal.get<any>(path);
    const updated = local.filter(item => !ids.includes(item.id || item.uid || ''));
    _privateLocal.save(path, updated);
    _privateListeners.notify(path);

    try {
      const promises = ids.map(id => deleteDoc(doc(db, path, id)));
      const promise = Promise.all(promises).then(() => {}).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, path);
      });
      return raceWithTimeout(promise, undefined, 3000);
    } catch (err) {
      console.error(`Error in deleteAll for ${path}:`, err);
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};
