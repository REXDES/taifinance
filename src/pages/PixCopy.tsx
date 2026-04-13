import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy } from "lucide-react";

type CopyStatus = "idle" | "copied" | "error";

const PixCopy = () => {
  const [searchParams] = useSearchParams();
  const pixCode = useMemo(() => searchParams.get("code") ?? "", [searchParams]);
  const description = useMemo(() => searchParams.get("desc") ?? "", [searchParams]);
  const amount = useMemo(() => searchParams.get("amount") ?? "", [searchParams]);
  const company = useMemo(() => searchParams.get("company") ?? "", [searchParams]);
  const [status, setStatus] = useState<CopyStatus>("idle");

  const formatCurrency = (val: string) => {
    const num = Number(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  const copyToClipboard = useCallback(async () => {
    if (!pixCode) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixCode);
      } else {
        const ta = document.createElement("textarea");
        ta.value = pixCode;
        ta.setAttribute("readonly", "true");
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    }
  }, [pixCode]);

  // Hide Lovable badge
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      #lovable-badge, [data-lovable-badge], .lovable-badge,
      a[href*="lovable.dev"], a[href*="lovable.app/projects"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  if (!pixCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4">
        <p className="text-[#666] text-sm">Link inválido ou código PIX não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 py-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#00A868] px-5 py-4 text-white text-center">
          <p className="text-lg font-bold">💰 Cobrança PIX</p>
          {company && <p className="text-sm opacity-90 mt-0.5">{company}</p>}
        </div>

        <div className="p-5 space-y-4">
          {/* Details */}
          {(description || amount) && (
            <div className="space-y-2 text-sm">
              {description && (
                <div className="flex justify-between">
                  <span className="text-[#888]">Descrição</span>
                  <span className="font-medium text-[#333] text-right max-w-[60%]">{description}</span>
                </div>
              )}
              {amount && (
                <div className="flex justify-between">
                  <span className="text-[#888]">Valor</span>
                  <span className="font-bold text-[#00A868] text-lg">{formatCurrency(amount)}</span>
                </div>
              )}
            </div>
          )}

          {/* QR Code */}
          <div className="flex justify-center py-3">
            <div className="bg-white p-3 rounded-xl border border-[#eee]">
              <QRCodeSVG value={pixCode} size={180} />
            </div>
          </div>

          {/* Clickable PIX code */}
          <div className="space-y-2">
            <p className="text-xs text-[#888] text-center">Toque no código abaixo para copiar:</p>
            <button
              onClick={copyToClipboard}
              className="w-full rounded-xl border-2 border-dashed border-[#00A868]/30 bg-[#f0faf5] p-3 text-xs font-mono text-[#333] break-all text-left transition-all active:scale-[0.98] hover:border-[#00A868]/60"
            >
              {pixCode}
            </button>

            {status === "copied" && (
              <div className="flex items-center justify-center gap-1.5 text-[#00A868] text-sm font-medium animate-in fade-in">
                <Check className="w-4 h-4" />
                Código copiado!
              </div>
            )}

            {status === "error" && (
              <p className="text-xs text-[#e53935] text-center">
                Não foi possível copiar automaticamente. Selecione o código manualmente.
              </p>
            )}
          </div>

          {/* Copy button */}
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center justify-center gap-2 bg-[#00A868] hover:bg-[#008c56] text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            {status === "copied" ? (
              <>
                <Check className="w-5 h-5" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copiar código PIX
              </>
            )}
          </button>

          <p className="text-[10px] text-[#aaa] text-center leading-tight">
            Cole o código no aplicativo do seu banco na opção Pix Copia e Cola para efetuar o pagamento.
          </p>
        </div>
      </div>
    </main>
  );
};

export default PixCopy;
