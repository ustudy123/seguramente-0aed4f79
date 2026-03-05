import { useState } from "react";
import { X } from "lucide-react";

export function WhatsAppButton() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <>
      <div className="whatsapp-container">
        <button
          onClick={() => setVisible(false)}
          className="whatsapp-close"
          aria-label="Fechar botão do WhatsApp"
        >
          <X className="h-3 w-3 text-white" />
        </button>
        <a
          href="https://api.whatsapp.com/send?phone=5546999337504"
          className="whatsapp-float"
          aria-label="Botão para contato no WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="whatsapp-icon" viewBox="0 0 48 48">
            <path d="M.33,48.33,3.06,35.62A23.67,23.67,0,0,1,0,24,24.06,24.06,0,0,1,24.12,0h0a23.95,23.95,0,1,1,0,47.89,24.33,24.33,0,0,1-11-2.61ZM13.7,41.08l.67.36a20.3,20.3,0,0,0,9.74,2.49A20,20,0,1,0,4,24a19.78,19.78,0,0,0,2.89,10.3l.41.68L5.52,43Z" />
            <path d="M34.67,31.75C34.22,33,32,34.21,31,34.31S30,35.12,24.5,33s-9-7.77-9.27-8.13S13,21.92,13,19.27a6.08,6.08,0,0,1,1.89-4.5,2,2,0,0,1,1.45-.67c.36,0,.72.05,1,.05s.77-.18,1.22.9,1.54,3.72,1.67,4a1,1,0,0,1,.05.95,3.53,3.53,0,0,1-.54.89c-.28.32-.58.71-.82.95s-.55.56-.24,1.09a16.48,16.48,0,0,0,3,3.73,14.93,14.93,0,0,0,4.37,2.68c.54.26.86.22,1.17-.14s1.36-1.58,1.72-2.12.72-.45,1.22-.26,3.17,1.47,3.71,1.74.9.41,1,.63A4.4,4.4,0,0,1,34.67,31.75Z" />
          </svg>
        </a>
      </div>
      <style>{`
        .whatsapp-container {
          position: fixed;
          bottom: 40px;
          right: 40px;
          z-index: 99999;
        }
        .whatsapp-close {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: hsl(var(--destructive));
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          transition: transform 0.15s;
        }
        .whatsapp-close:hover {
          transform: scale(1.15);
        }
        .whatsapp-float {
          cursor: pointer;
          width: 60px;
          height: 60px;
          background-color: #00c800;
          border-radius: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: whatsapp-pulse 3s infinite;
          transition: background-color 0.3s;
        }
        .whatsapp-float:hover {
          background-color: #009600;
        }
        .whatsapp-icon {
          width: 32px;
          height: 32px;
          fill: #fff;
          pointer-events: none;
        }
        @keyframes whatsapp-pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 200, 0, 1); }
          70% { box-shadow: 0 0 0 20px rgba(0, 200, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 200, 0, 0); }
        }
      `}</style>
    </>
  );
}
