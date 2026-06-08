import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, CheckCircle, ArrowRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SystemField {
  key: string;
  label: string;
  required: boolean;
}

export const SYSTEM_FIELDS: SystemField[] = [
  { key: "cnpjEmpresa", label: "CNPJ/CPF Empresa", required: true },
  { key: "nome", label: "Nome Completo", required: true },
  { key: "cpf", label: "CPF", required: true },
  { key: "dataNascimento", label: "Data de Nascimento", required: true },
  { key: "cargo", label: "Cargo", required: true },
  { key: "departamento", label: "Departamento / Setor", required: true },
  { key: "dataAdmissao", label: "Data de Admissão", required: true },
  { key: "sexo", label: "Sexo", required: false },
  { key: "estadoCivil", label: "Estado Civil", required: false },
  { key: "naturalidade", label: "Naturalidade", required: false },
  { key: "nacionalidade", label: "Nacionalidade", required: false },
  { key: "nomeMae", label: "Nome da Mãe", required: false },
  { key: "nomePai", label: "Nome do Pai", required: false },
  { key: "rg", label: "RG", required: false },
  { key: "pis", label: "PIS/PASEP", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "telefone", label: "Telefone", required: false },
  { key: "celular", label: "Celular", required: false },
  { key: "cep", label: "CEP", required: false },
  { key: "endereco", label: "Endereço", required: false },
  { key: "numero", label: "Número", required: false },
  { key: "complemento", label: "Complemento", required: false },
  { key: "bairro", label: "Bairro", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "estado", label: "Estado (UF)", required: false },
  { key: "situacao", label: "Situação (Ativo/Inativo)", required: false },
  { key: "filial", label: "Filial", required: false },
  { key: "nivel", label: "Nível", required: false },
  { key: "tipoContrato", label: "Tipo de Contrato", required: false },
  { key: "salario", label: "Salário", required: false },
  { key: "centroCusto", label: "Centro de Custo", required: false },
  { key: "gestorImediato", label: "Gestor Imediato", required: false },
  { key: "matriculaEsocial", label: "Matrícula eSocial", required: false },
  { key: "banco", label: "Banco", required: false },
  { key: "agencia", label: "Agência", required: false },
  { key: "conta", label: "Conta", required: false },
  { key: "tipoConta", label: "Tipo de Conta", required: false },
  { key: "chavePix", label: "Chave PIX", required: false },
];

// Auto-detection keywords per field
const AUTO_DETECT: Record<string, string[]> = {
  cnpjEmpresa: ["cnpj", "cpf empresa", "documento empresa", "empresa"],
  nome: ["nome", "funcionario", "colaborador", "name"],
  cpf: ["cpf", "documento"],
  dataNascimento: ["nascimento", "nasc", "birth"],
  cargo: ["cargo", "funcao", "função", "ocupacao", "job", "position"],
  departamento: ["departamento", "depto", "setor", "area", "department"],
  dataAdmissao: ["admissao", "admissão", "contratacao", "hire"],
  sexo: ["sexo", "genero", "gênero", "gender"],
  estadoCivil: ["civil", "estado civil"],
  naturalidade: ["naturalidade"],
  nacionalidade: ["nacionalidade"],
  nomeMae: ["mae", "mãe", "mother"],
  nomePai: ["pai", "father"],
  rg: ["rg", "identidade"],
  pis: ["pis", "pasep", "nis"],
  email: ["email", "e-mail", "mail"],
  telefone: ["telefone", "fone", "phone"],
  celular: ["celular", "whatsapp", "mobile", "cel"],
  cep: ["cep", "postal"],
  endereco: ["endereco", "endereço", "logradouro", "rua", "address"],
  numero: ["numero", "número", "num"],
  complemento: ["complemento", "comp"],
  bairro: ["bairro"],
  cidade: ["cidade", "municipio", "city"],
  estado: ["estado", "uf"],
  situacao: ["situacao", "situação", "status", "ativo"],
  filial: ["filial", "unidade"],
  nivel: ["nivel", "nível", "senioridade"],
  tipoContrato: ["contrato", "vinculo", "vínculo", "regime"],
  salario: ["salario", "salário", "remuneracao"],
  centroCusto: ["custo", "centro"],
  gestorImediato: ["gestor", "supervisor", "lider"],
  matriculaEsocial: ["matricula", "esocial"],
  banco: ["banco"],
  agencia: ["agencia", "agência"],
  conta: ["conta"],
  tipoConta: ["tipo conta"],
  chavePix: ["pix"],
};

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
}

function autoDetectMapping(fileHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const field of SYSTEM_FIELDS) {
    const keywords = AUTO_DETECT[field.key] || [];
    for (const header of fileHeaders) {
      if (usedHeaders.has(header)) continue;
      const normalizedHeader = normalize(header);
      
      // Guard: if looking for 'cpf', skip headers containing 'empresa'
      if (field.key === "cpf" && normalizedHeader.includes("empresa")) continue;
      
      // Guard: if looking for 'cnpjEmpresa', skip if header is exactly 'cpf'
      if (field.key === "cnpjEmpresa" && normalizedHeader === "cpf") continue;
      
      for (const kw of keywords) {
        if (normalizedHeader.includes(normalize(kw))) {
          mapping[field.key] = header;
          usedHeaders.add(header);
          break;
        }
      }
      if (mapping[field.key]) break;
    }
  }
  return mapping;
}

interface ColumnMappingStepProps {
  fileHeaders: string[];
  sampleRows: any[][];
  onConfirm: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

export function ColumnMappingStep({ fileHeaders, sampleRows, onConfirm, onBack }: ColumnMappingStepProps) {
  const initialMapping = useMemo(() => autoDetectMapping(fileHeaders), [fileHeaders]);
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  // Sync mapping state when fileHeaders prop changes (e.g., new file uploaded)
  useEffect(() => {
    setMapping(autoDetectMapping(fileHeaders));
  }, [fileHeaders]);

  const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
  const optionalFields = SYSTEM_FIELDS.filter(f => !f.required);
  const unmappedRequired = requiredFields.filter(f => !mapping[f.key]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  const handleChange = (fieldKey: string, headerValue: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (headerValue === "__none__") {
        delete next[fieldKey];
      } else {
        next[fieldKey] = headerValue;
      }
      return next;
    });
  };

  const getSampleValue = (header: string): string => {
    if (!sampleRows.length) return "";
    const colIdx = fileHeaders.indexOf(header);
    if (colIdx === -1) return "";
    const val = sampleRows[0]?.[colIdx];
    return val != null ? String(val).substring(0, 40) : "";
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header info */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-sm">Parametrização de Colunas</p>
            <p className="text-xs text-muted-foreground">
              {mappedCount} de {SYSTEM_FIELDS.length} campos mapeados • {fileHeaders.length} colunas detectadas no arquivo
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {unmappedRequired.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg shrink-0">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Campos obrigatórios não mapeados:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {unmappedRequired.map(f => (
                <Badge key={f.key} variant="destructive" className="text-xs">{f.label}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {unmappedRequired.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg shrink-0">
          <CheckCircle className="w-4 h-4 text-success" />
          <p className="text-sm font-medium text-success">Todos os campos obrigatórios estão mapeados!</p>
        </div>
      )}

      {/* Mapping table */}
      <ScrollArea className="flex-1 min-h-0 border rounded-lg">
        <div className="p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campos Obrigatórios</p>
          {requiredFields.map(field => (
            <MappingRow
              key={field.key}
              field={field}
              fileHeaders={fileHeaders}
              value={mapping[field.key] || ""}
              sampleValue={mapping[field.key] ? getSampleValue(mapping[field.key]) : ""}
              onChange={(v) => handleChange(field.key, v)}
            />
          ))}
          
          <div className="border-t my-3" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Campos Opcionais</p>
          {optionalFields.map(field => (
            <MappingRow
              key={field.key}
              field={field}
              fileHeaders={fileHeaders}
              value={mapping[field.key] || ""}
              sampleValue={mapping[field.key] ? getSampleValue(mapping[field.key]) : ""}
              onChange={(v) => handleChange(field.key, v)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-between items-center pt-2 shrink-0 border-t">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={() => onConfirm(mapping)} disabled={unmappedRequired.length > 0}>
          Continuar com importação
        </Button>
      </div>
    </div>
  );
}

function MappingRow({
  field,
  fileHeaders,
  value,
  sampleValue,
  onChange,
}: {
  field: SystemField;
  fileHeaders: string[];
  value: string;
  sampleValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-[180px] shrink-0 flex items-center gap-1">
        <span className="text-sm truncate">
          {field.label}
        </span>
        {field.required && <span className="text-destructive text-xs">*</span>}
      </div>
      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
      <Select value={value || "__none__"} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
          <SelectValue placeholder="Não mapeado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Não mapeado —</SelectItem>
          {fileHeaders.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sampleValue && (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] shrink-0" title={sampleValue}>
          ex: {sampleValue}
        </span>
      )}
    </div>
  );
}
