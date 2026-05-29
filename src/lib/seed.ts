import { collection, getDocs, limit, query, doc, setDoc } from 'firebase/firestore';
import { db, genericService } from './firestoreService';

const SAMPLE_POSTOS = [
  { id: 'p1', nome: 'Shopping Central (Armado)', status: 'Ativo', armado: true, supervisorId: 'u1', checklistItemIds: ['c1', 'c2', 'c3', 'c4', 'c5'] },
  { id: 'p2', nome: 'Condomínio Solar', status: 'Ativo', armado: false, supervisorId: 'u2', checklistItemIds: ['c1', 'c2', 'c5', 'c6'] },
  { id: 'p3', nome: 'Indústria Metalúrgica (Armado)', status: 'Ativo', armado: true, supervisorId: 'u4', checklistItemIds: ['c1', 'c2', 'c3', 'c4', 'c5'] },
  { id: 'p4', nome: 'Hospital São Luiz', status: 'Ativo', armado: false, supervisorId: 'u5', checklistItemIds: ['c1', 'c2', 'c5', 'c6'] },
  { id: 'p5', nome: 'Supermercado Todo Dia', status: 'Ativo', armado: false, supervisorId: 'u6', checklistItemIds: ['c1', 'c2', 'c5'] }
];

const SAMPLE_CHECKLIST_ITEMS = [
  { id: 'c1', nome: 'Livro de ocorrência preenchido?', aplicacao: 'Ambos', status: 'Ativo' },
  { id: 'c2', nome: 'Uniforme e apresentação pessoal?', aplicacao: 'Ambos', status: 'Ativo' },
  { id: 'c3', nome: 'Vigilante com armamento e munição?', aplicacao: 'Armado', status: 'Ativo' },
  { id: 'c4', nome: 'Colete balístico dentro do prazo?', aplicacao: 'Armado', status: 'Ativo' },
  { id: 'c5', nome: 'Rádio ou celular de apoio carregado?', aplicacao: 'Ambos', status: 'Ativo' },
  { id: 'c6', nome: 'Portão e controle de acesso funcionando?', aplicacao: 'Desarmado', status: 'Ativo' }
];

const SAMPLE_VIGILANTES = [
  { id: 'v1', nome: 'João Silva', matricula: 'V001', cpf: '111.111.111-11', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p1', escala: '12x36' },
  { id: 'v2', nome: 'Maria Oliveira', matricula: 'V002', cpf: '222.222.222-22', funcao: 'Supervisor', status: 'Ativo', postoFixoId: 'p2', escala: '5x2' },
  { id: 'v3', nome: 'Carlos Santos', matricula: 'V003', cpf: '333.333.333-33', funcao: 'Volante', status: 'Ativo', escala: '12x36' },
  { id: 'v4', nome: 'Ana Costa', matricula: 'V004', cpf: '444.444.444-44', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p3', escala: '12x36' },
  { id: 'v5', nome: 'Pedro Rocha', matricula: 'V005', cpf: '555.555.555-55', funcao: 'Intermitente', status: 'Ativo', escala: 'Intermitente' },
  { id: 'v6', nome: 'Lucas Mendes', matricula: 'V006', cpf: '666.666.666-66', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p4', escala: '12x36' },
  { id: 'v7', nome: 'Fernanda Lima', matricula: 'V007', cpf: '777.777.777-77', funcao: 'Almoxarife', status: 'Ativo', escala: '5x2' },
  { id: 'v8', nome: 'Roberto Alves', matricula: 'V008', cpf: '888.888.888-88', funcao: 'Vigilante', status: 'Ativo', postoFixoId: 'p5', escala: '12x36' }
];

const SAMPLE_MOTIVOS_FALTA = [
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
];

const SAMPLE_TIPOS_COBERTURA = [
  { id: "UGE3SvtUxkWPrnJEVWiK", nome: "HORISTA" },
  { id: "l8HffqKlMU6gIQukwCpD", "nome": "XXX" },
  { id: "r2JCWrzFDQ694G9qLiwc", nome: "SUPERVISOR" },
  { id: "tc1", status: "Ativo", nome: "INTERMITENTE" },
  { id: "tc2", nome: "BANCO DE HORAS", status: "Ativo" },
  { id: "tc3", nome: "HORA EXTRA", status: "Ativo" },
  { id: "tc4", status: "Ativo", nome: "VOLANTE" }
];

const SAMPLE_VIATURAS = [
  { id: 'vt1', placa: 'BRA2E19' },
  { id: 'vt2', placa: 'GUA4F22' },
  { id: 'vt3', placa: 'ROTA999' }
];

const SAMPLE_ROTEIROS = [
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
      { name: "MUNIC FPOLIS SME-EBM VIRGÍLIO DOS R VARZEA", id: "mrbmU4ngJ2ipmU7lQ4BL" },
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
      { name: "MUNIC FPOLIS SME-EBM VIRGÍLIO DOS R VARZEA", id: "mrbmU4ngJ2ipmU7lQ4BL" }
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
      { nome: "MUNIC FPOLIS SME-NEIM HASSIS", "id": "xVQ8hFihUIqF6o64jFwz" },
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
      { name: "MUNIC FPOLIS SME-NEIM JULIA M RODRIGUES", id: "cES6YC6NZrAbO9E8ZXDT" },
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
      { name: "MUNIC FPOLIS SME-EBM TAPERA-ESC DO FUTURO", id: "h5zB2DWEJbBXGY4h2SY6" },
      { nome: "MUNIC FPOLIS SME-EBM JOÃO G PINHEIRO", id: "p0ZoBdxFb6p8eRwIOrjE" }
    ]
  },
  {
    id: "vWBF7Zxv40I61OW0U1Vo",
    postos: [
      { nome: "SES-HOSP REG HOMERO", id: "fBJXgQRthpfvHSvNwUAj" },
      { nome: "SES-INST DE CARDIOLOGIA", id: "hMo3JVqw8bPgAoNBLuFi" },
      { name: "SES-GEPAT", id: "ArzEA3mwXYiC9lR3IsDc" },
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
      { name: "MUNIC FPOLIS SME-EBM OSVALDO GALUPO", id: "n6NBiPSBUYIPxDcmDWW4" },
      { name: "EPAGRI-FPOLIS SEDE", id: "yYRbb3TztWVW2wl5Waif" },
      { nome: "MUNIC FPOLIS SME-EBM VITOR MIGUEL DE SOUZA", id: "6Q9Gr8HfYiOCqXFNO4Mw" },
      { name: "EPAGRI-FPOIS C.TREIN", id: "miYH0MMPH1iZq4euTSMC" },
      { name: "MUNIC FPOLIS SME-EBM ACÁCIO G SÃO THIAGO", id: "nnT06rcvjD4denJ0MCrV" },
      { name: "MUNIC FPOLIS SME-EBM JOÃO ALFREDO ROHR", id: "wm8QWH0y2h9DhcmWPoBr" },
      { name: "MUNIC FPOLIS SME-EBM JOSÉ JACINTO CARDOSO", id: "WmphQOKnzZe8WFlpDwko" },
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
      { name: "MUNIC FPOLIS SME-EBM OSVALDO GALUPO", id: "n6NBiPSBUYIPxDcmDWW4" },
      { name: "EPAGRI-FPOLIS SEDE", id: "yYRbb3TztWVW2wl5Waif" },
      { nome: "MUNIC FPOLIS SME-EBM BEATRIZ DE S BRITO", id: "vIkOr3Ml4gXXHZphCBjR" }
    ],
    turno: "Noturno",
    diaSemana: "Quarta-feira",
    nome: "QUARTA FEIRA - NOTURNO "
  }
];

const DEFAULT_USERS = [
  { uid: 'u1', matricula: 'roberto', displayName: 'Roberto', role: 'Supervisor', password: '1234' },
  { uid: 'u2', matricula: 'aloir', displayName: 'Aloir', role: 'Supervisor', password: '1234' },
  { uid: 'u3', matricula: 'cleito', displayName: 'Cleito', role: 'Admin', password: '1234' },
  { uid: 'u4', matricula: 'arthur', displayName: 'Arthur', role: 'Admin', password: '1234' },
  { uid: 'u5', matricula: 'luiz henrique', displayName: 'Luiz Henrique', role: 'Supervisor', password: '1234' },
  { uid: 'u6', matricula: 'reinaldo', displayName: 'Reinaldo', role: 'Supervisor', password: '1234' },
  { uid: 'u7', matricula: 'marcio', displayName: 'Márcio', role: 'Supervisor', password: '1234' },
  { uid: 'u8', matricula: 'arthursouza1106@gmail.com', displayName: 'Arthur Souza', role: 'Admin', password: '1234' }
];

async function isCollectionEmptyInFirestore(path: string): Promise<boolean> {
  try {
    const q = query(collection(db, path), limit(1));
    const snap = await getDocs(q);
    return snap.empty;
  } catch (error) {
    console.warn(`[Firestore] Error querying isCollectionEmpty for ${path}:`, error);
    return true;
  }
}

export async function seedDatabase() {
  try {
    console.log('[Firestore] Running fine-grained cloud database seeding verification...');

    // 1. Seed or update missing Users
    try {
      const storedUsers = await genericService.list<any>('users').catch(() => []);
      for (const u of DEFAULT_USERS) {
        const exists = storedUsers.some(su => (su.matricula || '').toLowerCase().trim() === (u.matricula || '').toLowerCase().trim());
        if (!exists) {
          console.log(`[Firestore Seeding] Seeding missing user: ${u.displayName}`);
          await genericService.create('users', u).catch(() => {});
        }
      }
    } catch (usersErr) {
      console.warn('[Firestore Seeding] Users check failed:', usersErr);
    }

    // 2. Seed other collections conditionally if they are completely empty
    
    // Check and seed Postos
    const postosEmpty = await isCollectionEmptyInFirestore('postos');
    if (postosEmpty) {
      console.log('[Firestore Seeding] Seeding default Postos...');
      for (const posto of SAMPLE_POSTOS) {
        await genericService.create('postos', posto).catch(() => {});
      }
    }

    // Check and seed Checklist Items
    const checklistEmpty = await isCollectionEmptyInFirestore('checklistItems');
    if (checklistEmpty) {
      console.log('[Firestore Seeding] Seeding default Checklist Items...');
      for (const item of SAMPLE_CHECKLIST_ITEMS) {
        await genericService.create('checklistItems', item).catch(() => {});
      }
    }

    // Check and seed Vigilantes
    const vigilantesEmpty = await isCollectionEmptyInFirestore('vigilantes');
    if (vigilantesEmpty) {
      console.log('[Firestore Seeding] Seeding default Vigilantes...');
      for (const v of SAMPLE_VIGILANTES) {
        await genericService.create('vigilantes', v).catch(() => {});
      }
    }

    // Check and seed Motivos Falta
    const motivosEmpty = await isCollectionEmptyInFirestore('motivos_falta');
    if (motivosEmpty) {
      console.log('[Firestore Seeding] Seeding default Motivos Falta...');
      for (const m of SAMPLE_MOTIVOS_FALTA) {
        await genericService.create('motivos_falta', m).catch(() => {});
      }
    }

    // Check and seed Tipos Cobertura
    const tiposEmpty = await isCollectionEmptyInFirestore('tipos_cobertura');
    if (tiposEmpty) {
      console.log('[Firestore Seeding] Seeding default Tipos Cobertura...');
      for (const tc of SAMPLE_TIPOS_COBERTURA) {
        await genericService.create('tipos_cobertura', tc).catch(() => {});
      }
    }

    // Check and seed Viaturas
    const viaturasEmpty = await isCollectionEmptyInFirestore('viaturas');
    if (viaturasEmpty) {
      console.log('[Firestore Seeding] Seeding default Viaturas...');
      for (const vt of SAMPLE_VIATURAS) {
        await genericService.create('viaturas', vt).catch(() => {});
      }
    }

    // Check and seed Roteiros
    const roteirosEmpty = await isCollectionEmptyInFirestore('roteiros');
    if (roteirosEmpty) {
      console.log('[Firestore Seeding] Seeding default Roteiros...');
      for (const r of SAMPLE_ROTEIROS) {
        await genericService.create('roteiros', r).catch(() => {});
      }
    }

    // 3. Mark database as fully verified & seeded
    try {
      const seedDocRef = doc(db, 'settings', 'database_seeded');
      await setDoc(seedDocRef, { seeded: true, verifiedAt: new Date().toISOString() });
    } catch (saveErr) {
      console.warn('[Firestore] Could not record seeded document on server:', saveErr);
    }

    localStorage.setItem('vigi_system_is_seeded', 'true');
    console.log('[Firestore] Fine-grained database seeding/repair check completed.');
    return true;
  } catch (error) {
    console.error('[Firestore] Error in seedDatabase:', error);
    return false;
  }
}

export async function forceSeedDatabase() {
  try {
    console.log('[Firestore] Initiating FORCE seeding/repair...');
    
    for (const u of DEFAULT_USERS) {
      await genericService.create('users', u).catch(() => {});
    }
    for (const posto of SAMPLE_POSTOS) {
      await genericService.create('postos', posto).catch(() => {});
    }
    for (const item of SAMPLE_CHECKLIST_ITEMS) {
      await genericService.create('checklistItems', item).catch(() => {});
    }
    for (const v of SAMPLE_VIGILANTES) {
      await genericService.create('vigilantes', v).catch(() => {});
    }
    for (const m of SAMPLE_MOTIVOS_FALTA) {
      await genericService.create('motivos_falta', m).catch(() => {});
    }
    for (const tc of SAMPLE_TIPOS_COBERTURA) {
      await genericService.create('tipos_cobertura', tc).catch(() => {});
    }
    for (const vt of SAMPLE_VIATURAS) {
      await genericService.create('viaturas', vt).catch(() => {});
    }
    for (const r of SAMPLE_ROTEIROS) {
      await genericService.create('roteiros', r).catch(() => {});
    }

    console.log('[Firestore] FORCE seeding completed successfully.');
    return true;
  } catch (error) {
    console.error('[Firestore] Error in forceSeedDatabase:', error);
    return false;
  }
}
