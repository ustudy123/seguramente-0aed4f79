import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Listens for postMessage events from a parent window (e.g. QA Agent iframe)
 * and navigates the app via React Router — no full page reload.
 * Also handles query invalidation to refresh data when the agent mutates the DB.
 */
export function useIframeNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "qa-navigate" && typeof event.data.route === "string") {
        navigate(event.data.route);
      }
      if (event.data?.type === "qa-refresh") {
        // Invalidate all queries so the UI reflects DB changes made by the agent
        queryClient.invalidateQueries();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate, queryClient]);
}
