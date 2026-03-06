import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Listens for postMessage events from a parent window (e.g. QA Agent iframe)
 * and navigates the app via React Router — no full page reload.
 */
export function useIframeNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "qa-navigate" && typeof event.data.route === "string") {
        navigate(event.data.route);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [navigate]);
}
