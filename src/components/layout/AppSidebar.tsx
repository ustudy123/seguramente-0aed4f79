import { useState, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  UserCog,
  MessageSquareHeart,
  Clock,
  Calendar,
  Star,
  FileText,
  Target,
  Shield,
  Activity,
  Heart,
  FolderOpen,
  MessageCircle,
  DollarSign,
  UserPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  Stethoscope,
  Building2,
  BookOpen,
  Compass,
  Store,
  HardHat,
  ShieldAlert,
  HeartPulse,
  Sparkles,
  Newspaper,
  Route,
  Search,
  X,
  Brain,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: {title: string;path: string;}[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
  color: string;
  sectionIcon: React.ElementType;
}

const menuSections: MenuSection[] = [
{
  label: "Visão Geral & Estratégia",
  color: "text-blue-400",
  sectionIcon: Compass,
  items: [
  { title: "Início", icon: Home, path: "/" },
  { title: "Estratégia & Governança", icon: Compass, path: "/estrategia" }]

},
{
  label: "Saúde & Segurança",
  color: "text-amber-400",
  sectionIcon: HeartPulse,
  items: [
  { title: "Compliance SST", icon: FileText, path: "/compliance-sst" },
  { title: "Incidentes & Acidentes", icon: ShieldAlert, path: "/incidentes-acidentes" },
  { title: "Ergonomia", icon: Activity, path: "/ergonomia" },
  { title: "Psicossocial NR-01", icon: Brain, path: "/psicossocial" },
  { title: "EPIs", icon: Shield, path: "/epis" }]

},
{
  label: "Planos & Desenvolvimento",
  color: "text-emerald-400",
  sectionIcon: Target,
  items: [
  { title: "Plano de Ação", icon: Target, path: "/plano-acao" },
  { title: "Avaliações", icon: Star, path: "/avaliacoes" },
  { title: "PDI", icon: Target, path: "/pdi" }]

},
{
  label: "Pessoas & Cultura",
  color: "text-violet-400",
  sectionIcon: Users,
  items: [
  { title: "Colaboradores", icon: Users, path: "/colaboradores" },
  { title: "Onboarding", icon: UserPlus, path: "/onboarding" },
  { title: "Férias", icon: Calendar, path: "/ferias" },
  { title: "Atestados", icon: Stethoscope, path: "/atestados" },
  { title: "Meu Bem-Estar", icon: Heart, path: "/felicidade" },
  { title: "Feedback & Ocorrências", icon: MessageCircle, path: "/feedback-ocorrencias" },
  { title: "Ouvidoria", icon: MessageSquareHeart, path: "/ouvidoria" },
  { title: "Aprendizado & Papéis", icon: BookOpen, path: "/aprendizado-papeis" },
  { title: "Trilhas", icon: Route, path: "/trilhas" },
  { title: "Cultura & Celebrações", icon: Sparkles, path: "/cultura-celebracoes" },
  { title: "Mural Interno", icon: Newspaper, path: "/feed" },
  { title: "Ponto", icon: Clock, path: "/ponto" },
  { title: "Análise de Jornada", icon: BarChart3, path: "/analise-jornada" }]

},
{
  label: "Estrutura Organizacional",
  color: "text-cyan-400",
  sectionIcon: Building2,
  items: [
  { title: "Empresa", icon: Building2, path: "/empresa" },
  {
    title: "Cadastros",
    icon: FolderOpen,
    children: [
    { title: "Departamentos", path: "/cadastros/departamentos" },
    { title: "Funções", path: "/cadastros/cargos" },
    { title: "Estabelecimento ou Obra", path: "/cadastros/filiais" }]

  },
  { title: "Rede de Parceiros", icon: Store, path: "/marketplace" },
  { title: "Terceiros & SST", icon: HardHat, path: "/terceiros" }]

},
{
  label: "Documentos & Registros",
  color: "text-rose-400",
  sectionIcon: FileText,
  items: [
  { title: "Documentos", icon: FileText, path: "/documentos" }]

},
{
  label: "Financeiro",
  color: "text-teal-400",
  sectionIcon: DollarSign,
  items: [
    { title: "Financeiro", icon: DollarSign, path: "/financeiro" },
    { title: "Benefícios", icon: Heart, path: "/financeiro/beneficios" },
    { title: "Hub Contábil", icon: FileText, path: "/hub-contabil" },
  ]
}];


const SidebarSubItem = ({ item, isCollapsed }: {item: MenuItem;isCollapsed: boolean;}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
          "hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground",
          isOpen && "bg-sidebar-accent/60 text-sidebar-foreground"
        )}>

        <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
        {!isCollapsed &&
        <>
            <span className="flex-1 text-left text-[13px] font-medium">{item.title}</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} />
          </>
        }
      </button>
      <AnimatePresence>
        {isOpen && !isCollapsed &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden">

            <div className="ml-6 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
              {item.children?.map((child) =>
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
              cn(
                "block px-3 py-1.5 rounded-md text-[13px] transition-all duration-200",
                isActive ?
                "bg-sidebar-primary text-sidebar-primary-foreground" :
                "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )
              }>

                  {child.title}
                </NavLink>
            )}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

const SidebarLink = ({ item }: {item: MenuItem;isCollapsed: boolean;}) =>
<NavLink
  to={item.path || "/"}
  className={({ isActive }) =>
  cn(
    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
    isActive ?
    "bg-sidebar-primary text-sidebar-primary-foreground font-medium" :
    "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
  )
  }>

    <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
    <span className="text-[13px]">{item.title}</span>
  </NavLink>;


const CollapsibleSection = ({
  section,
  isCollapsed,
  isOpen,
  onToggle





}: {section: MenuSection;isCollapsed: boolean;isOpen: boolean;onToggle: () => void;}) => {
  const location = useLocation();
  const hasActiveChild = section.items.some(
    (item) =>
    item.path === location.pathname ||
    item.children?.some((c) => c.path === location.pathname)
  );

  if (isCollapsed) {
    return (
      <div className="mb-1">
        <div className="pt-1 flex items-center justify-center px-2 mb-1">
          <section.sectionIcon className={cn("w-4 h-4", section.color, "opacity-50")} strokeWidth={1.75} />
        </div>
        {section.items.map((item) =>
        item.children ?
        <SidebarSubItem key={item.title} item={item} isCollapsed={isCollapsed} /> :

        <NavLink
          key={item.title}
          to={item.path || "/"}
          className={({ isActive }) =>
          cn(
            "flex items-center justify-center py-2 rounded-lg transition-all duration-200 my-0.5",
            isActive ?
            "bg-sidebar-primary text-sidebar-primary-foreground" :
            "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )
          }>

              <item.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </NavLink>

        )}
      </div>);

  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors",
          "hover:bg-sidebar-accent/40 group cursor-pointer",
          hasActiveChild && "bg-sidebar-accent/20"
        )}>

        <section.sectionIcon className={cn("w-4 h-4 flex-shrink-0 transition-colors", section.color)} strokeWidth={2} />
        <p className={cn("flex-1 text-left text-[11px] font-bold uppercase tracking-wider transition-colors text-success-foreground",

        hasActiveChild ? "text-sidebar-foreground/70" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/65"
        )}>
          {section.label}
        </p>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-all duration-200",
            isOpen && "rotate-180"
          )} />

      </button>
      <AnimatePresence initial={false}>
        {isOpen &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden">

            <div className="space-y-0.5 mt-1">
              {section.items.map((item) =>
            item.children ?
            <SidebarSubItem key={item.title} item={item} isCollapsed={false} /> :

            <SidebarLink key={item.title} item={item} isCollapsed={false} />

            )}
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar = ({ isCollapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Flatten all navigable items for search
  const allItems = useMemo(() => {
    const items: {title: string;path: string;icon: React.ElementType;sectionLabel: string;}[] = [];
    menuSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.path) items.push({ title: item.title, path: item.path, icon: item.icon, sectionLabel: section.label });
        item.children?.forEach((child) => {
          items.push({ title: child.title, path: child.path, icon: item.icon, sectionLabel: section.label });
        });
      });
    });
    // Add Configurações
    items.push({ title: "Configurações", path: "/configuracoes", icon: Settings, sectionLabel: "Sistema" });
    return items;
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allItems.filter((item) => item.title.toLowerCase().includes(q));
  }, [searchQuery, allItems]);

  const isSearching = searchQuery.trim().length > 0;

  // Auto-open sections that contain the active route
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuSections.forEach((section) => {
      const hasActive = section.items.some(
        (item) =>
        item.path === location.pathname ||
        item.children?.some((c) => c.path === location.pathname)
      );
      initial[section.label] = hasActive;
    });
    return initial;
  });

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen gradient-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-40">

      <div className="p-4 flex items-center justify-center border-b border-sidebar-border bg-white rounded-br-xl">
        {isCollapsed ?
        <Logo size="md" showText={false} /> :

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Logo size="md" showText={false} />
          </motion.div>
        }
      </div>

      {/* Search bar */}
      {!isCollapsed &&
      <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
            <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar módulo..."
            className="w-full pl-8 pr-8 py-2 rounded-lg bg-sidebar-accent/40 border border-sidebar-border text-[13px] text-sidebar-foreground placeholder:text-sidebar-foreground/35 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/50 focus:bg-sidebar-accent/60 transition-all" />

            {isSearching &&
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors">

                <X className="w-3.5 h-3.5" />
              </button>
          }
          </div>
        </div>
      }

      <nav className="flex-1 p-3 space-y-3 overflow-y-auto scrollbar-thin">
        {isSearching ?
        <div className="space-y-0.5">
            {searchResults.length === 0 ?
          <p className="text-[12px] text-sidebar-foreground/40 text-center py-4">Nenhum resultado encontrado</p> :

          searchResults.map((item) =>
          <button
            key={item.path}
            onClick={() => {navigate(item.path);setSearchQuery("");}}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left",
              location.pathname === item.path ?
              "bg-sidebar-primary text-sidebar-primary-foreground font-medium" :
              "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}>

                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] truncate">{item.title}</span>
                    <span className="text-[10px] text-sidebar-foreground/35 truncate">{item.sectionLabel}</span>
                  </div>
                </button>
          )
          }
          </div> :

        menuSections.map((section) =>
        <CollapsibleSection
          key={section.label}
          section={section}
          isCollapsed={isCollapsed}
          isOpen={!!openSections[section.label]}
          onToggle={() => toggleSection(section.label)} />

        )
        }
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
          cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            isActive ?
            "bg-sidebar-primary text-sidebar-primary-foreground" :
            "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          )
          }>

          <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
          {!isCollapsed && <span className="text-[13px]">Configurações</span>}
        </NavLink>
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors">

        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>);

};