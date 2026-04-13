import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CopyStatus = "idle" | "success" | "error";

const PixCopy = () => {
  const [searchParams] = useSearchParams();
  const pixCode = useMemo(() => searchParams.get("code") ?? "", [searchParams]);
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [message, setMessage] = useState("Abrindo a cópia do código PIX...");

  const copyPixCode = useCallback(async () => {
    if (!pixCode) {
      setStatus("error");
      setMessage("O código PIX não foi encontrado neste link.");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = pixCode;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error("copy_failed");
        }
      }

      setStatus("success");
      setMessage("Código PIX copiado para a área de transferência.");
    } catch {
      setStatus("error");
      setMessage("Seu navegador bloqueou a cópia automática. Toque no botão abaixo para copiar.");
    }
  }, [pixCode]);

  useEffect(() => {
    void copyPixCode();
  }, [copyPixCode]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <Card className="w-full max-w-xl border-border shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl">Copiar código PIX</CardTitle>
          <CardDescription>
            Ao abrir esta página, tentamos copiar o código automaticamente no seu celular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-left text-xs font-mono text-foreground break-all max-h-56 overflow-y-auto">
            {pixCode || "Código PIX indisponível."}
          </div>

          <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
            {message}
          </div>

          {status !== "success" && pixCode ? (
            <Button className="w-full" onClick={copyPixCode}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar código PIX
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};

export default PixCopy;
