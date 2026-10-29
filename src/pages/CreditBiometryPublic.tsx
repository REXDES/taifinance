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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

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
      if (data.status === 'approved' || data.status === 'rejected') {
        setStep('done');
      }
      setLoading(false);
    })();
  }, [token]);

  // Start only after the video element mounts; permission failures must not hide the file controls.
  useEffect(() => {
    if (step !== 'selfie' && step !== 'doc-front' && step !== 'doc-back') return;
    let cancelled = false;
    setCameraReady(false);
    setCameraError(null);
    setError(null);
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível neste navegador.');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: step === 'selfie' ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) { video.srcObject = stream; await video.play(); }
      } catch {
        if (!cancelled) setCameraError('Não foi possível abrir a câmera aqui. Use “Tirar foto” ou “Selecionar foto”.');
      }
    };
    void start();
    return () => { cancelled = true; stopCamera(); };
  }, [step]);

  const capture = (): string => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return '';
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  useEffect(() => () => stopCamera(), []);

  const acceptPhoto = (image: string) => {
    if (!image) { setError('A câmera ainda não está pronta. Tente tirar ou selecionar uma foto.'); return; }
    setError(null);
    stopCamera();
    if (step === 'selfie') { setSelfie(image); setStep('doc-front'); }
    else if (step === 'doc-front') { setDocFront(image); setStep('doc-back'); }
    else { setDocBack(image); setStep('review'); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPreparing(true);
    setError(null);
    const fail = () => { setPreparing(false); setError('Não foi possível preparar essa foto. Tire uma nova foto ou escolha uma imagem JPG ou PNG.'); };
    const reader = new FileReader();
    reader.onerror = fail;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const context = c.getContext('2d');
        if (!context || !c.width || !c.height) { fail(); return; }
        context.drawImage(img, 0, 0, c.width, c.height);
        setPreparing(false);
        acceptPhoto(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = fail;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!selfie || !docFront) { setError('Capture selfie e documento (frente)'); return; }
    setStep('sending');
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => { timeoutId = setTimeout(() => rej(new Error('Não conseguimos confirmar o recebimento. Verifique sua internet e tente novamente.')), 120000); });
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke('credit-biometry-analyze', {
          body: { token, selfie_b64: selfie, doc_front_b64: docFront, doc_back_b64: docBack },
        }),
        timeout,
      ]);
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('O recebimento das fotos não foi confirmado. Tente novamente.');
      setStep('done');
    } catch (e: any) {
      setError('Não foi possível confirmar o envio. ' + (e.message || 'Erro ao enviar'));
      setStep('error');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!bio && error) return <Center><XCircle className="w-12 h-12 text-destructive mb-3" /><p>{error}</p></Center>;

  if (step === 'done') return (
    <Center>
      <CheckCircle2 className="w-14 h-14 text-primary mb-3" />
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
      <p className="text-sm">Enviando suas fotos e analisando… não feche esta página.</p>
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
        <Button onClick={() => setStep('selfie')}>Começar</Button>
      </Center>
    );
  }

  if (step === 'selfie' || step === 'doc-front' || step === 'doc-back') {
    const label = step === 'selfie' ? 'Tire uma selfie' : step === 'doc-front' ? 'Documento (frente)' : 'Documento (verso) — opcional';
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-3">
        <h2 className="text-lg font-bold">{label}</h2>
        <video ref={videoRef} className="rounded border w-full max-w-md h-[min(52dvh,480px)] object-contain bg-muted" autoPlay playsInline muted onLoadedData={() => setCameraReady(true)} onCanPlay={() => setCameraReady(true)} />
        {cameraError && <p className="text-sm text-muted-foreground text-center max-w-md" role="status">{cameraError}</p>}
        {error && <p className="text-sm text-destructive text-center max-w-md" role="alert">{error}</p>}
        {preparing && <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="w-4 h-4 animate-spin" />Preparando foto…</p>}
        <div className="flex gap-2 flex-wrap justify-center">
          <Button disabled={!cameraReady || preparing} onClick={() => acceptPhoto(capture())}><Camera className="w-4 h-4 mr-2" />Capturar</Button>
          <input key={`${step}-camera`} ref={cameraInputRef} aria-label="Tirar foto" type="file" accept="image/*" capture={step === 'selfie' ? 'user' : 'environment'} className="hidden" onChange={handleFile} />
          <input key={`${step}-gallery`} ref={galleryInputRef} aria-label="Selecionar foto" type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button variant="outline" disabled={preparing} onClick={() => { stopCamera(); setCameraReady(false); cameraInputRef.current?.click(); }}><Camera className="w-4 h-4 mr-2" />Tirar foto</Button>
          <Button variant="outline" disabled={preparing} onClick={() => galleryInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Selecionar foto</Button>
          {step === 'doc-back' && (
            <Button variant="ghost" disabled={preparing} onClick={() => { stopCamera(); setStep('review'); }}>Pular</Button>
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
        <Button variant="outline" onClick={() => { setSelfie(null); setDocFront(null); setDocBack(null); setStep('selfie'); }}>Refazer</Button>
        <Button onClick={submit}>Enviar para análise</Button>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">{children}</div>;
}
