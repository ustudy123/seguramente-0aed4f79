import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  MessageSquare,
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
  Eye,
  AlertTriangle,
  ClipboardList,
  UsersRound,
  Landmark,
  FileStack,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  children?: { title: string; path: string; icon?: React.ElementType }[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    label: "Visão Geral & Estratégia",
    items: [
      { title: "Início", icon: Home, path: "/" },
      { title: "Estratégia & Governança", icon: Compass, path: "/estrategia" },
    ],
  },
  {
    label: "Riscos & Conformidade",
    items: [
      { title: "Compliance SST", icon: FileText, path: "/compliance-sst" },
      { title: "Incidentes & Acidentes", icon: ShieldAlert, path: "/incidentes-acidentes" },
      { title: "Ergonomia", icon: Activity, path: "/ergonomia" },
      { title: "EPIs", icon: Shield, path: "/epis" },
    ],
  },
  {
    label: "Planos, Avaliações & Desenvolvimento",
    items: [
      { title: "Plano de Ação", icon: Target, path: "/plano-acao" },
      { title: "Avaliações", icon: Star, path: "/avaliacoes" },
      { title: "PDI", icon: Target, path: "/pdi" },
    ],
  },
  {
    label: "Pessoas & Cultura",
    items: [
      { title: "Colaboradores", icon: Users, path: "/colaboradores" },
      { title: "Admissão", icon: UserPlus, path: "/admissao" },
      { title: "Férias", icon: Calendar, path: "/ferias" },
      { title: "Atestados", icon: Stethoscope, path: "/atestados" },
      { title: "Gestão da Felicidade", icon: Heart, path: "/felicidade" },
      { title: "Feedback & Ocorrências", icon: MessageCircle, path: "/feedback-ocorrencias" },
      { title: "Ouvidoria", icon: MessageSquareHeart, path: "/ouvidoria" },
      { title: "Aprendizado & Papéis", icon: BookOpen, path: "/aprendizado-papeis" },
      { title: "Ponto", icon: Clock, path: "/ponto" },
    ],
  },
  {
    label: "Estrutura Organizacional",
    items: [
      { title: "Empresa", icon: Building2, path: "/empresa" },
      {
        title: "Cadastros",
        icon: FolderOpen,
        children: [
          { title: "Departamentos", path: "/cadastros/departamentos" },
          { title: "Funções", path: "/cadastros/cargos" },
          { title: "Filiais", path: "/cadastros/filiais" },
        ],
      },
      { title: "Rede de Parceiros", icon: Store, path: "/marketplace" },
      { title: "Terceiros & SST", icon: HardHat, path: "/terceiros" },
    ],
  },
  {
    label: "Documentação & Registros",
    items: [
      { title: "Documentos", icon: FileText, path: "/documentos" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", icon: DollarSign, path: "/financeiro" },
    ],
  },
];

interface SidebarItemProps {
  item: MenuItem;
  isCollapsed: boolean;
  isActive: boolean;
}

const SidebarItem = ({ item, isCollapsed, isActive }: SidebarItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            "hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground",
            isOpen && "bg-sidebar-accent/60 text-sidebar-foreground"
          )}
        >
          <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-[13px] font-medium">{item.title}</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
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
              <div className="ml-6 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                {item.children?.map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={({ isActive }) =>
                      cn(
                        "block px-3 py-1.5 rounded-md text-[13px] transition-all duration-200",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )
                    }
                  >
                    {child.title}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <NavLink
      to={item.path || "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )
      }
    >
      <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
      {!isCollapsed && <span className="text-[13px]">{item.title}</span>}
    </NavLink>
  );
};

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const AppSidebar = ({ isCollapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen gradient-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-40"
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border bg-white rounded-br-xl">
        {isCollapsed ? (
          <Logo size="md" showText={false} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Logo size="md" showText={true} textClassName="text-foreground" />
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-thin">
        {menuSections.map((section) => (
          <div key={section.label}>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {section.label}
              </p>
            )}
            {isCollapsed && <div className="mb-1 border-t border-sidebar-border/30" />}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.title}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={item.path === location.pathname}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )
          }
        >
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
          {!isCollapsed && <span className="text-[13px]">Configurações</span>}
        </NavLink>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </motion.aside>
  );
};
