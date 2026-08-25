import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, Upload, CheckCircle2, XCircle } from 'lucide-react';

type Bio = { id: string; application_id: string; company_id: string; status: string };

export default function CreditBiometryPublic() {
  const { token } = useParams<{ token: string }>();
  const [bio, setBio] = useState<Bio | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'intro' | 'selfie' | 'doc-front' | 'doc-back' | 'review' | 'sending' | 'done' | 'error'>('intro');
  const [selfie, setSelfie] = useState<string | null>(null);
  const [docFront, setDocFront] = useState<string | null>(null);
  const [docBack, setDocBack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setError('Token inválido'); setLoading(false); return; }
      const { data, error } = await (supabase as any)
        .from('credit_biometry')
        .select('id, application_id, company_id, status')
        .eq('public_token', token)
        .maybeSingle();
      if (error || !data) { setError('Link não encontrado'); setLoading(false); return; }
      setBio(data);
      if (data.status === 'approved' || data.status === 'rejected' || data.status === 'analyzing') {
        setStep('done');
      }
      setLoading(false);
    })();
  }, [token]);

  const startCamera = async (facing: 'user' | 'environment') => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      setError('Não foi possível acessar a câmera: ' + e.message);
    }
  };

  const capture = (): string => {
    const video = videoRef.current;
    if (!video) return '';
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  useEffect(() => () => stopCamera(), []);

  const handleFile = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!selfie || !docFront) { setError('Capture selfie e documento (frente)'); return; }
    setStep('sending');
    try {
      const { data, error } = await supabase.functions.invoke('credit-biometry-analyze', {
        body: { token, selfie_b64: selfie, doc_front_b64: docFront, doc_back_b64: docBack },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Erro ao enviar');
      setStep('error');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error && step !== 'error') return <Center><XCircle className="w-12 h-12 text-destructive mb-3" /><p>{error}</p></Center>;

  if (step === 'done') return (
    <Center>
      <CheckCircle2 className="w-14 h-14 text-emerald-600 mb-3" />
      <h2 className="text-lg font-bold">Tudo certo!</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
        Recebemos sua biometria. Em instantes a análise estará disponível para a empresa.
      </p>
    </Center>
  );

  if (step === 'error') return (
    <Center>
      <XCircle className="w-12 h-12 text-destructive mb-3" />
      <p className="text-sm text-center">{error}</p>
      <Button className="mt-4" onClick={() => { setError(null); setStep('review'); }}>Tentar novamente</Button>
    </Center>
  );

  if (step === 'sending') return (
    <Center>
      <Loader2 className="w-10 h-10 animate-spin mb-3" />
      <p className="text-sm">Analisando sua biometria com IA…</p>
    </Center>
  );

  if (step === 'intro') {
    return (
      <Center>
        <Camera className="w-10 h-10 mb-3 text-primary" />
        <h1 className="text-xl font-bold">Verificação de identidade</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm mt-2 mb-4">
          Vamos precisar de uma selfie e de uma foto do seu documento (RG ou CNH).
        </p>
        <Button onClick={() => { setStep('selfie'); startCamera('user'); }}>Começar</Button>
      </Center>
    );
  }

  if (step === 'selfie' || step === 'doc-front' || step === 'doc-back') {
    const label = step === 'selfie' ? 'Tire uma selfie' : step === 'doc-front' ? 'Documento (frente)' : 'Documento (verso) — opcional';
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-3">
        <h2 className="text-lg font-bold">{label}</h2>
        <video ref={videoRef} className="rounded border w-full max-w-md aspect-[3/4] object-cover bg-black" playsInline muted />
        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={() => {
            const img = capture();
            if (step === 'selfie') { setSelfie(img); stopCamera(); setStep('doc-front'); startCamera('environment'); }
            else if (step === 'doc-front') { setDocFront(img); stopCamera(); setStep('doc-back'); startCamera('environment'); }
            else { setDocBack(img); stopCamera(); setStep('review'); }
          }}><Camera className="w-4 h-4 mr-2" />Capturar</Button>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" capture={step === 'selfie' ? 'user' : 'environment'} className="hidden"
              onChange={handleFile((v) => {
                if (step === 'selfie') { setSelfie(v); stopCamera(); setStep('doc-front'); startCamera('environment'); }
                else if (step === 'doc-front') { setDocFront(v); stopCamera(); setStep('doc-back'); startCamera('environment'); }
                else { setDocBack(v); stopCamera(); setStep('review'); }
              })} />
            <Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Enviar arquivo</span></Button>
          </label>
          {step === 'doc-back' && (
            <Button variant="ghost" onClick={() => { stopCamera(); setStep('review'); }}>Pular</Button>
          )}
        </div>
      </div>
    );
  }

  // review
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-3">
      <h2 className="text-lg font-bold">Confirme as imagens</h2>
      <div className="grid grid-cols-3 gap-2 w-full max-w-md">
        {selfie && <img src={selfie} alt="selfie" className="rounded border aspect-square object-cover" />}
        {docFront && <img src={docFront} alt="frente" className="rounded border aspect-square object-cover" />}
        {docBack && <img src={docBack} alt="verso" className="rounded border aspect-square object-cover" />}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { setSelfie(null); setDocFront(null); setDocBack(null); setStep('selfie'); startCamera('user'); }}>Refazer</Button>
        <Button onClick={submit}>Enviar para análise</Button>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">{children}</div>;
}
