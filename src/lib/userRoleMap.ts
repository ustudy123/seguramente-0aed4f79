export type AppUserRole = "admin" | "manager" | "user";

const managerTipos = new Set([
  "gestor",
  "lideranca",
  "rh_dp",
  "implantador",
  "suporte_autorizado",
  "corporativo_multiempresa",
]);

export function mapTipoUsuarioToAppRole(tipoUsuario?: string): AppUserRole {
  if (tipoUsuario === "administrador") return "admin";
  if (tipoUsuario && managerTipos.has(tipoUsuario)) return "manager";
  return "user";
}
