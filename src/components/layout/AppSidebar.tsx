import { useState, useMemo } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  MessageSquareHeart,
  ClipboardList,
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
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: { title: string; path: string }[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
  color: string;
  sectionIcon: React.ElementType;
}

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const checkIsActive = (path: string, pathname: string, search: string) => {
  if (!path) return false;
  const fullPath = pathname + search;
  if (path.includes("?")) {
    return fullPath === path;
  }
  if (path === "/estrategia") {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    return pathname === "/estrategia" && (!tab || (tab !== "organograma" && tab !== "cultura"));
  }
  return pathname === path;
};

const menuSections: MenuSection[] = [
  {
    label: "Minha Gestão",
    color: "text-amber-400",
    sectionIcon: ClipboardList,
    items: [
      { title: "Início", icon: Home, path: "/" },
      { title: "Pendências", icon: ClipboardList, path: "/pendencias" },
    ],
  },

  {
    label: "Estrutura Organizacional",
    color: "text-cyan-400",
    sectionIcon: Building2,
    items: [
      { title: "Empresa", icon: Building2, path: "/empresa" },
      { title: "Estabelecimento ou Obra", icon: Building2, path: "/cadastros/filiais" },
      { title: "Departamentos", icon: Building2, path: "/cadastros/departamentos" },
      { title: "Funções", icon: Users, path: "/cadastros/cargos" },
      { title: "Colaboradores", icon: Users, path: "/colaboradores" },
      { title: "Organograma", icon: Users, path: "/estrategia?tab=organograma" },
      { title: "Cultura", icon: Heart, path: "/estrategia?tab=cultura" },
      { title: "Cultura & Celebrações", icon: Sparkles, path: "/cultura-celebracoes" },
      { title: "Rede de Parceiros", icon: Store, path: "/marketplace" },
    ],
  },
  {
    label: "Visão Geral & Estratégia",
    color: "text-blue-400",
    sectionIcon: Compass,
    items: [
      { title: "Estratégia & Governança", icon: Compass, path: "/estrategia" },
    ],
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
      { title: "EPIs", icon: Shield, path: "/epis" },
      { title: "Terceiros & SST", icon: HardHat, path: "/terceiros" },
    ],
  },
  {
    label: "Planos & Desenvolvimento",
    color: "text-emerald-400",
    sectionIcon: Target,
    items: [
      { title: "Metas", icon: Target, path: "/metas" },
      { title: "Plano de Ação", icon: Target, path: "/plano-acao" },
      { title: "Avaliações", icon: Star, path: "/avaliacoes" },
      { title: "PDI", icon: Target, path: "/pdi" },
    ],
  },
  {
    label: "Pessoas & Cultura",
    color: "text-violet-400",
    sectionIcon: Users,
    items: [
      { title: "Contratos de Experiência", icon: FileText, path: "/contratos-experiencia" },
      { title: "Onboarding", icon: UserPlus, path: "/onboarding-rh" },
      { title: "Férias", icon: Calendar, path: "/ferias" },
      { title: "Atestados", icon: Stethoscope, path: "/atestados" },
      { title: "Meu Bem-Estar", icon: Heart, path: "/felicidade" },
      { title: "Feedback & Ocorrências", icon: MessageCircle, path: "/feedback-ocorrencias" },
      { title: "Ouvidoria", icon: MessageSquareHeart, path: "/ouvidoria" },
      { title: "Aprendizado & Papéis", icon: BookOpen, path: "/aprendizado-papeis" },
      { title: "Trilhas", icon: Route, path: "/trilhas" },
      { title: "Mural Interno", icon: Newspaper, path: "/feed" },
      { title: "Ponto", icon: Clock, path: "/ponto" },
      { title: "Análise de Jornada", icon: BarChart3, path: "/analise-jornada" },
    ],
  },
  {
    label: "Documentos & Registros",
    color: "text-rose-400",
    sectionIcon: FileText,
    items: [{ title: "Documentos", icon: FileText, path: "/documentos" }],
  },
  {
    label: "Financeiro",
    color: "text-teal-400",
    sectionIcon: DollarSign,
    items: [
      { title: "Financeiro", icon: DollarSign, path: "/financeiro" },
      { title: "Benefícios", icon: Heart, path: "/financeiro/beneficios" },
      { title: "Hub Contábil", icon: FileText, path: "/hub-contabil" },
    ],
  },
  {
    label: "Academia",
    color: "text-indigo-400",
    sectionIcon: BookOpen,
    items: [{ title: "Academia", icon: BookOpen, path: "/academia" }],
  },
];

const SidebarSubItem = ({ item, isCollapsed }: { item: MenuItem; isCollapsed: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-white/[0.06] text-sidebar-foreground/70 hover:text-sidebar-foreground",
          isOpen && "bg-white/[0.06] text-sidebar-foreground"
        )}
      >
        <item.icon className="w-[18px] h-[18px] flex-shrink-0 opacity-75" strokeWidth={1.75} />
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left text-[13px] font-medium">{item.title}</span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 opacity-40 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </>
        )}
      </button>
      <AnimatePresence>
        {isOpen && !isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-7 mt-1 space-y-0.5 border-l-2 border-white/[0.08] pl-3">
              {item.children?.map((child) => {
                const isActive = checkIsActive(child.path, location.pathname, location.search);
                return (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={cn(
                      "block px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/55 hover:bg-white/[0.06] hover:text-sidebar-foreground"
                    )}
                  >
                    {child.title}
                  </NavLink>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SidebarLink = ({ item, onNavigate }: { item: MenuItem; isCollapsed: boolean; onNavigate?: () => void }) => {
  const location = useLocation();
  const isActive = checkIsActive(item.path || "/", location.pathname, location.search);

  return (
    <NavLink
      to={item.path || "/"}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group/link",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md shadow-sidebar-primary/20"
          : "text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground"
      )}
    >
      <item.icon
        className={cn("w-[18px] h-[18px] flex-shrink-0 transition-colors", !isActive && "opacity-75")}
        strokeWidth={1.75}
      />
      <span className="text-[13px]">{item.title}</span>
    </NavLink>
  );
};

const CollapsibleSection = ({
  section,
  isCollapsed,
  isOpen,
  onToggle,
  onNavigate,
}: {
  section: MenuSection;
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) => {
  const location = useLocation();

  const hasActiveChild = section.items.some(
    (item) =>
      checkIsActive(item.path || "/", location.pathname, location.search) ||
      item.children?.some((c) => checkIsActive(c.path, location.pathname, location.search))
  );

  if (isCollapsed) {
    return (
      <div className="mb-1">
        <div className="pt-1 flex items-center justify-center px-2 mb-1">
          <section.sectionIcon
            className={cn("w-4 h-4", section.color, "opacity-50")}
            strokeWidth={1.75}
          />
        </div>
        {section.items.map((item) => {
          const isActive = checkIsActive(item.path || "/", location.pathname, location.search);
          return item.children ? (
            <SidebarSubItem key={item.title} item={item} isCollapsed={isCollapsed} />
          ) : (
            <NavLink
              key={item.title}
              to={item.path || "/"}
              className={cn(
                "flex items-center justify-center py-2.5 rounded-lg transition-all duration-200 my-0.5",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </NavLink>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200",
          "hover:bg-white/[0.04] group cursor-pointer",
          hasActiveChild && "bg-white/[0.04]"
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
            hasActiveChild ? "bg-white/[0.1]" : "bg-white/[0.05]"
          )}
        >
          <section.sectionIcon className={cn("w-3.5 h-3.5", section.color)} strokeWidth={2} />
        </div>
        <p
          className={cn(
            "flex-1 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors",
            hasActiveChild
              ? "text-sidebar-foreground/80"
              : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60"
          )}
        >
          {section.label}
        </p>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-sidebar-foreground/25 group-hover:text-sidebar-foreground/45 transition-all duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 mt-1 ml-1">
              {section.items.map((item) =>
                item.children ? (
                  <SidebarSubItem key={item.title} item={item} isCollapsed={false} />
                ) : (
                  <SidebarLink key={item.title} item={item} isCollapsed={false} onNavigate={onNavigate} />
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export const AppSidebar = ({ isCollapsed, onToggle, isMobile, onClose }: AppSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { isSuperAdmin } = useAuthContext();

  const filteredSections = useMemo(() => {
    if (isSuperAdmin) return menuSections;
    return menuSections.filter((s) => s.label !== "Academia");
  }, [isSuperAdmin]);

  const allItems = useMemo(() => {
    const items: { title: string; path: string; icon: React.ElementType; sectionLabel: string }[] = [];
    
    // Search items from sections


    filteredSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.path)
          items.push({ title: item.title, path: item.path, icon: item.icon, sectionLabel: section.label });
        item.children?.forEach((child) => {
          items.push({ title: child.title, path: child.path, icon: item.icon, sectionLabel: section.label });
        });
      });
    });
    items.push({ title: "Configurações", path: "/configuracoes", icon: Settings, sectionLabel: "Sistema" });
    items.push({ title: "Suporte", path: "/suporte", icon: LifeBuoy, sectionLabel: "Sistema" });
    return items;
  }, [filteredSections]);

  const normalizedQuery = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return allItems.filter((item) => {
      const normalizedTitle = normalizeSearchText(item.title);
      const normalizedSection = normalizeSearchText(item.sectionLabel);
      return normalizedTitle.includes(normalizedQuery) || normalizedSection.includes(normalizedQuery);
    });
  }, [normalizedQuery, allItems]);

  const isSearching = normalizedQuery.length > 0;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    filteredSections.forEach((section) => {
      const hasActive = section.items.some(
        (item) =>
          checkIsActive(item.path || "/", location.pathname, location.search) ||
          item.children?.some((c) => checkIsActive(c.path, location.pathname, location.search))
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
      animate={{ width: isCollapsed ? 72 : 264 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen gradient-sidebar border-r border-white/[0.06] flex flex-col fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-center border-b border-white/[0.08] bg-white rounded-b-xl">
        {isCollapsed ? (
          <Logo size="md" showText={false} />
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Logo size="md" showText={false} />
          </motion.div>
        )}
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="px-3 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/35" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar módulo..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/[0.07] border border-white/[0.08] text-[13px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-primary/60 focus:bg-white/[0.1] focus:border-sidebar-primary/30 transition-all"
            />
            {isSearching && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground/35 hover:text-sidebar-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin">
        {isSearching ? (
          <div className="space-y-0.5">
            {searchResults.length === 0 ? (
              <p className="text-[12px] text-sidebar-foreground/35 text-center py-6">
                Nenhum resultado encontrado
              </p>
            ) : (
              searchResults.map((item) => {
                const isActive = checkIsActive(item.path, location.pathname, location.search);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSearchQuery("");
                      if (isMobile && onClose) onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0 opacity-75" strokeWidth={1.75} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] truncate">{item.title}</span>
                      <span className="text-[10px] text-sidebar-foreground/30 truncate">
                        {item.sectionLabel}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <NavLink
              to="/"
              onClick={isMobile ? onClose : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20 font-medium"
                    : "text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-sidebar-foreground"
                )
              }
            >
              <Home className={cn("w-[18px] h-[18px] flex-shrink-0 transition-colors opacity-75")} strokeWidth={1.75} />
              {!isCollapsed && <span className="text-[13px]">Início</span>}
            </NavLink>

            {filteredSections.map((section) => (
              <CollapsibleSection
                key={section.label}
                section={section}
                isCollapsed={isCollapsed}
                isOpen={!!openSections[section.label]}
                onToggle={() => toggleSection(section.label)}
                onNavigate={isMobile ? onClose : undefined}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.08] space-y-0.5">
        <NavLink
          to="/suporte"
          onClick={isMobile ? onClose : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                : "text-sidebar-foreground/55 hover:bg-white/[0.06] hover:text-sidebar-foreground"
            )
          }
        >
          <LifeBuoy className="w-[18px] h-[18px] opacity-75" strokeWidth={1.75} />
          {!isCollapsed && <span className="text-[13px]">Suporte</span>}
        </NavLink>
        <NavLink
          to="/configuracoes"
          onClick={isMobile ? onClose : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                : "text-sidebar-foreground/55 hover:bg-white/[0.06] hover:text-sidebar-foreground"
            )
          }
        >
          <Settings className="w-[18px] h-[18px] opacity-75" strokeWidth={1.75} />
          {!isCollapsed && <span className="text-[13px]">Configurações</span>}
        </NavLink>
      </div>
    </motion.aside>
  );
};
