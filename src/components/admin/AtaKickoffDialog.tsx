import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, Plus, X, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AtaKickoffData {
  data_reuniao: string;
  horario_inicio: string;
  horario_fim: string;
  local: string;
  modalidade: string;
  responsavel_seguramente: string;
  participantes_seguramente: string;
  participantes_cliente: string;
  objetivo: string;
  pauta: string[];
  encaminhamentos: string[];
  proximos_passos: string;
  observacoes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onEnviar: (html: string) => void;
  isLoading: boolean;
  nomeEmpresa: string;
  pocNome: string | null;
  responsavelSeguramente: string | null;
}

export function AtaKickoffDialog({ open, onClose, onEnviar, isLoading, nomeEmpresa, pocNome, responsavelSeguramente }: Props) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const [preview, setPreview] = useState(false);
  const [form, setForm] = useState<AtaKickoffData>({
    data_reuniao: hoje,
    horario_inicio: '09:00',
    horario_fim: '10:00',
    local: 'Videoconferência (Google Meet / Zoom)',
    modalidade: 'Online',
    responsavel_seguramente: responsavelSeguramente || 'Equipe YourEyes',
    participantes_seguramente: responsavelSeguramente || 'Representante YourEyes',
    participantes_cliente: pocNome || '',
    objetivo: 'Apresentação da plataforma YourEyes, alinhamento de expectativas, definição do escopo inicial e cronograma de implantação.',
    pauta: [
      'Apresentação da plataforma YourEyes e seus módulos',
      'Alinhamento de expectativas e objetivos do projeto',
      'Definição do responsável interno pelo sistema',
      'Escopo inicial e prioridades de implantação',
      'Cronograma de atividades e marcos',
      'Próximos passos e definição de responsabilidades',
    ],
    encaminhamentos: [
      `Compartilhar credenciais de acesso à plataforma para ${pocNome || 'o responsável indicado'}`,
      'Enviar planilha modelo para importação de colaboradores',
      'Agendar reunião de acompanhamento em 15 dias',
    ],
    proximos_passos: 'Configuração inicial da empresa na plataforma, importação de colaboradores e início do diagnóstico organizacional.',
    observacoes: '',
  });

  const addItem = (field: 'pauta' | 'encaminhamentos') => {
    setForm(p => ({ ...p, [field]: [...p[field], ''] }));
  };

  const removeItem = (field: 'pauta' | 'encaminhamentos', idx: number) => {
    setForm(p => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));
  };

  const updateItem = (field: 'pauta' | 'encaminhamentos', idx: number, val: string) => {
    setForm(p => {
      const arr = [...p[field]];
      arr[idx] = val;
      return { ...p, [field]: arr };
    });
  };

  const gerarHtml = (): string => {
    const dataFormatada = form.data_reuniao
      ? format(new Date(form.data_reuniao + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : '___/___/______';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 60px auto; max-width: 800px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 16pt; text-align: center; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
  h2 { font-size: 13pt; text-align: center; font-weight: normal; margin-bottom: 32px; color: #333; }
  .header-logo { text-align: center; margin-bottom: 24px; }
  .header-logo span { font-weight: bold; font-size: 18pt; color: #1a1a1a; letter-spacing: 2px; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .meta-table td { padding: 6px 10px; border: 1px solid #ccc; font-size: 11pt; }
  .meta-table td:first-child { font-weight: bold; background: #f5f5f5; width: 35%; }
  .section { margin-bottom: 24px; }
  .section-title { font-weight: bold; font-size: 12pt; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 4px; margin-bottom: 12px; }
  ol, ul { margin: 0; padding-left: 24px; }
  li { margin-bottom: 6px; }
  .assinaturas { margin-top: 60px; display: flex; justify-content: space-between; }
  .assinatura-bloco { text-align: center; width: 45%; }
  .assinatura-linha { border-top: 1px solid #333; padding-top: 8px; margin-top: 60px; font-size: 11pt; }
  p { text-align: justify; }
  .footer { margin-top: 40px; font-size: 9pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
</style>
</head>
<body>

<div class="header-logo"><span>YourEyes</span></div>

<h1>Ata de Reunião de Kickoff</h1>
<h2>Implantação da Plataforma YourEyes — ${nomeEmpresa}</h2>

<table class="meta-table">
  <tr><td>Data</td><td>${dataFormatada}</td></tr>
  <tr><td>Horário</td><td>${form.horario_inicio}${form.horario_fim ? ' às ' + form.horario_fim : ''}</td></tr>
  <tr><td>Local / Modalidade</td><td>${form.local} (${form.modalidade})</td></tr>
  <tr><td>Responsável YourEyes</td><td>${form.responsavel_seguramente}</td></tr>
  <tr><td>Participantes YourEyes</td><td>${form.participantes_seguramente}</td></tr>
  <tr><td>Participantes ${nomeEmpresa}</td><td>${form.participantes_cliente}</td></tr>
</table>

<div class="section">
  <div class="section-title">1. Objetivo da Reunião</div>
  <p>${form.objetivo}</p>
</div>

<div class="section">
  <div class="section-title">2. Pauta</div>
  <ol>
    ${form.pauta.filter(Boolean).map(item => `<li>${item}</li>`).join('\n    ')}
  </ol>
</div>

<div class="section">
  <div class="section-title">3. Encaminhamentos e Responsabilidades</div>
  <ul>
    ${form.encaminhamentos.filter(Boolean).map(item => `<li>${item}</li>`).join('\n    ')}
  </ul>
</div>

<div class="section">
  <div class="section-title">4. Próximos Passos</div>
  <p>${form.proximos_passos}</p>
</div>

${form.observacoes ? `<div class="section">
  <div class="section-title">5. Observações</div>
  <p>${form.observacoes}</p>
</div>` : ''}

<div class="assinaturas">
  <div class="assinatura-bloco">
    <div class="assinatura-linha">
      YourEyes TECNOLOGIA LTDA<br>
      <small>${form.responsavel_seguramente}</small>
    </div>
  </div>
  <div class="assinatura-bloco">
    <div class="assinatura-linha">
      ${nomeEmpresa}<br>
      <small>${form.participantes_cliente || '___________________'}</small>
    </div>
  </div>
</div>

<div class="footer">
  Documento gerado pela plataforma YourEyes em ${dataFormatada}
</div>

</body>
</html>`;
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 Ata de Kickoff — {nomeEmpresa}
          </DialogTitle>
        </DialogHeader>

        {preview ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Prévia do documento</span>
              <Button variant="outline" size="sm" onClick={() => setPreview(false)}>
                <EyeOff className="w-3 h-3 mr-1" /> Editar
              </Button>
            </div>
            <div
              className="border rounded-lg p-4 bg-white text-black text-sm overflow-auto max-h-[60vh]"
              dangerouslySetInnerHTML={{ __html: gerarHtml() }}
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => onEnviar(gerarHtml())} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar para o Cliente
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dados da Reunião */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados da Reunião</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data da Reunião</Label>
                  <Input type="date" value={form.data_reuniao} onChange={e => setForm(p => ({ ...p, data_reuniao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={form.horario_inicio} onChange={e => setForm(p => ({ ...p, horario_inicio: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Término</Label>
                    <Input type="time" value={form.horario_fim} onChange={e => setForm(p => ({ ...p, horario_fim: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} />
                </div>
                <div>
                  <Label>Modalidade</Label>
                  <Input value={form.modalidade} placeholder="Online / Presencial" onChange={e => setForm(p => ({ ...p, modalidade: e.target.value }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Participantes */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Participantes</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Responsável YourEyes</Label>
                  <Input value={form.responsavel_seguramente} onChange={e => setForm(p => ({ ...p, responsavel_seguramente: e.target.value }))} />
                </div>
                <div>
                  <Label>Participantes YourEyes</Label>
                  <Input value={form.participantes_seguramente} onChange={e => setForm(p => ({ ...p, participantes_seguramente: e.target.value }))} placeholder="Nome(s) dos representantes" />
                </div>
                <div>
                  <Label>Participantes do Cliente ({nomeEmpresa})</Label>
                  <Input value={form.participantes_cliente} onChange={e => setForm(p => ({ ...p, participantes_cliente: e.target.value }))} placeholder="Nome(s) dos representantes do cliente" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Objetivo */}
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Objetivo</p>
              <Textarea
                rows={2}
                value={form.objetivo}
                onChange={e => setForm(p => ({ ...p, objetivo: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Pauta */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pauta</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('pauta')}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.pauta.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                    <Input
                      value={item}
                      onChange={e => updateItem('pauta', i, e.target.value)}
                      placeholder={`Item ${i + 1} da pauta`}
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem('pauta', i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Encaminhamentos */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Encaminhamentos</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('encaminhamentos')}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {form.encaminhamentos.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-5">•</span>
                    <Input
                      value={item}
                      onChange={e => updateItem('encaminhamentos', i, e.target.value)}
                      placeholder={`Encaminhamento ${i + 1}`}
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem('encaminhamentos', i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Próximos Passos e Obs */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Próximos Passos</Label>
                <Textarea
                  rows={2}
                  value={form.proximos_passos}
                  onChange={e => setForm(p => ({ ...p, proximos_passos: e.target.value }))}
                />
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="outline" onClick={() => setPreview(true)}>
                <Eye className="w-4 h-4 mr-2" /> Pré-visualizar
              </Button>
              <Button onClick={() => onEnviar(gerarHtml())} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar para o Cliente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
