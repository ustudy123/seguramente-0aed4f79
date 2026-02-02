import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, User, CheckSquare, X } from "lucide-react";
import { useDepartamentos } from "@/hooks/useCadastros";
import { AEPEmpresaInfo } from "@/types/aep-multi";

interface AEPConfigInicialProps {
  empresa: AEPEmpresaInfo;
  avaliarTodosSetores: boolean;
  setoresSelecionados: { id: string; nome: string }[];
  onUpdateEmpresa: (updates: Partial<AEPEmpresaInfo>) => void;
  onSetAvaliarTodosSetores: (value: boolean) => void;
  onSetSetoresSelecionados: (setores: { id: string; nome: string }[]) => void;
}

export function AEPConfigInicial({
  empresa,
  avaliarTodosSetores,
  setoresSelecionados,
  onUpdateEmpresa,
  onSetAvaliarTodosSetores,
  onSetSetoresSelecionados
}: AEPConfigInicialProps) {
  const { departamentos, isLoading: loadingDepts } = useDepartamentos();
  const [searchSetor, setSearchSetor] = useState("");

  const departamentosAtivos = departamentos.filter(d => d.ativo);
  
  const filteredDepartamentos = departamentosAtivos.filter(d => 
    d.nome.toLowerCase().includes(searchSetor.toLowerCase())
  );

  const toggleSetor = (dept: { id: string; nome: string }) => {
    const exists = setoresSelecionados.find(s => s.id === dept.id);
    if (exists) {
      onSetSetoresSelecionados(setoresSelecionados.filter(s => s.id !== dept.id));
    } else {
      onSetSetoresSelecionados([...setoresSelecionados, { id: dept.id, nome: dept.nome }]);
    }
  };

  const handleTodosSetoresChange = (checked: boolean) => {
    onSetAvaliarTodosSetores(checked);
    if (checked) {
      onSetSetoresSelecionados([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dados da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Identificação da Empresa
          </CardTitle>
          <CardDescription>
            Dados da empresa para o documento AEP
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="empresa">Razão Social *</Label>
            <Input
              id="empresa"
              placeholder="Nome da empresa"
              value={empresa.nome}
              onChange={e => onUpdateEmpresa({ nome: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input
              id="cnpj"
              placeholder="00.000.000/0000-00"
              value={empresa.cnpj}
              onChange={e => onUpdateEmpresa({ cnpj: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidade" className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Unidade / Filial
            </Label>
            <Input
              id="unidade"
              placeholder="Matriz, Filial SP, etc."
              value={empresa.unidade}
              onChange={e => onUpdateEmpresa({ unidade: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataAvaliacao" className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Data da Avaliação
            </Label>
            <Input
              id="dataAvaliacao"
              type="date"
              value={empresa.dataAvaliacao}
              onChange={e => onUpdateEmpresa({ dataAvaliacao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel" className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Responsável pelo Levantamento *
            </Label>
            <Input
              id="responsavel"
              placeholder="Nome do avaliador"
              value={empresa.responsavelLevantamento}
              onChange={e => onUpdateEmpresa({ responsavelLevantamento: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="validador">Profissional Validador (opcional)</Label>
            <Input
              id="validador"
              placeholder="Ergonomista, Médico do Trabalho, etc."
              value={empresa.profissionalValidador}
              onChange={e => onUpdateEmpresa({ profissionalValidador: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Setores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Setores a Avaliar
          </CardTitle>
          <CardDescription>
            Selecione os setores que serão incluídos nesta AEP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle todos os setores */}
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
            <Checkbox
              id="todosSetores"
              checked={avaliarTodosSetores}
              onCheckedChange={handleTodosSetoresChange}
            />
            <Label htmlFor="todosSetores" className="font-medium cursor-pointer">
              Avaliar todos os setores da empresa
            </Label>
            {avaliarTodosSetores && (
              <Badge variant="secondary" className="ml-auto">
                {departamentosAtivos.length} setores
              </Badge>
            )}
          </div>

          {/* Seleção individual */}
          {!avaliarTodosSetores && (
            <div className="space-y-3">
              <Input
                placeholder="Buscar setor..."
                value={searchSetor}
                onChange={e => setSearchSetor(e.target.value)}
              />

              {/* Setores selecionados */}
              {setoresSelecionados.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {setoresSelecionados.map(setor => (
                    <Badge 
                      key={setor.id} 
                      variant="default"
                      className="flex items-center gap-1 pl-2"
                    >
                      {setor.nome}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 ml-1 hover:bg-primary-foreground/20"
                        onClick={() => toggleSetor(setor)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Lista de setores disponíveis */}
              <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                {loadingDepts ? (
                  <p className="text-sm text-muted-foreground p-2">Carregando setores...</p>
                ) : filteredDepartamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">
                    {departamentosAtivos.length === 0 
                      ? "Nenhum setor cadastrado. Cadastre departamentos primeiro."
                      : "Nenhum setor encontrado."}
                  </p>
                ) : (
                  filteredDepartamentos.map(dept => {
                    const isSelected = setoresSelecionados.some(s => s.id === dept.id);
                    return (
                      <div
                        key={dept.id}
                        className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleSetor({ id: dept.id, nome: dept.nome })}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSetor({ id: dept.id, nome: dept.nome })}
                        />
                        <span className="flex-1">{dept.nome}</span>
                        {dept.descricao && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {dept.descricao}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="pt-2 border-t text-sm text-muted-foreground">
            {avaliarTodosSetores ? (
              <span>Todos os {departamentosAtivos.length} setores serão avaliados</span>
            ) : setoresSelecionados.length > 0 ? (
              <span>{setoresSelecionados.length} setor(es) selecionado(s)</span>
            ) : (
              <span className="text-warning">Selecione pelo menos um setor para continuar</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
