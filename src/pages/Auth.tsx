import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Download, CheckCircle } from 'lucide-react';

interface InvitationData {
  id: string;
  email: string;
  name: string | null;
  company_id: string;
  expires_at: string;
  is_used: boolean;
  token_hash: string | null;
}

interface InvitationStatus {
  invitation_exists: boolean;
  is_used: boolean;
  is_expired: boolean;
  user_exists: boolean;
  user_email: string;
  invitation_name: string;
}

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Invitation state
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatus | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Check if we should show install prompt
      if (deferredPrompt) {
        setShowInstallPrompt(true);
        // Auto-hide after 10 seconds if user doesn't interact
        const timer = setTimeout(() => setShowInstallPrompt(false), 10000);
        return () => clearTimeout(timer);
      }
      navigate('/');
    }
  }, [user, loading, navigate, deferredPrompt]);

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check for invitation parameter
  useEffect(() => {
    const inviteId = searchParams.get('invite');
    if (inviteId) {
      checkInvitationStatus(inviteId);
    }
  }, [searchParams]);

  const checkInvitationStatus = async (inviteId: string) => {
    setInviteLoading(true);
    try {
      // First check the full status using our new RPC function
      const { data: statusData, error: statusError } = await supabase
        .rpc('check_invitation_status', { _invitation_id: inviteId });

      if (statusError) {
        console.error('Error checking invitation status:', statusError);
      }

      const status = statusData?.[0] as InvitationStatus | undefined;
      
      if (status) {
        setInvitationStatus(status);
        
        // If invitation doesn't exist
        if (!status.invitation_exists) {
          toast({
            title: 'Convite inválido',
            description: 'O convite não foi encontrado.',
            variant: 'destructive',
          });
          return;
        }

        // If user already exists for this email (account already created)
        if (status.user_exists || status.is_used) {
          setActiveTab('login');
          toast({
            title: 'Conta já criada!',
            description: `Use seu email ${status.user_email} para fazer login.`,
          });
          setLoginEmail(status.user_email);
          return;
        }

        // If invitation is expired
        if (status.is_expired) {
          toast({
            title: 'Convite expirado',
            description: 'Este convite não é mais válido. Solicite um novo convite.',
            variant: 'destructive',
          });
          return;
        }
      }

      // If all checks pass, fetch full invitation details
      await fetchInvitation(inviteId);
    } catch (err) {
      console.error('Error checking invitation:', err);
      // Fallback to direct fetch if status check fails
      await fetchInvitation(inviteId);
    } finally {
      setInviteLoading(false);
    }
  };

  const fetchInvitation = async (inviteId: string) => {
    try {
      // Use secure RPC function instead of direct table query
      const { data, error } = await (supabase.rpc as any)('get_invitation_by_id', { _invitation_id: inviteId });

      if (error || !data || data.length === 0) {
        toast({
          title: 'Convite inválido',
          description: 'O convite não foi encontrado.',
          variant: 'destructive',
        });
        return;
      }

      const invitation = data[0] as {
        id: string;
        email: string;
        name: string | null;
        company_id: string;
        expires_at: string;
        is_used: boolean;
        token_hash: string | null;
        role: string;
      };

      if (invitation.is_used) {
        toast({
          title: 'Convite já utilizado',
          description: 'Este convite já foi usado para criar uma conta. Faça login com seu email.',
        });
        setActiveTab('login');
        setLoginEmail(invitation.email);
        return;
      }

      if (new Date(invitation.expires_at) < new Date()) {
        toast({
          title: 'Convite expirado',
          description: 'Este convite não é mais válido.',
          variant: 'destructive',
        });
        return;
      }

      setInvitation({
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        company_id: invitation.company_id,
        expires_at: invitation.expires_at,
        is_used: invitation.is_used,
        token_hash: invitation.token_hash,
      });
      setSignupEmail(invitation.email);
      setSignupName(invitation.name || '');
      setActiveTab('signup');
    } catch (err) {
      console.error('Error fetching invitation:', err);
    }
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [invitePassword, setInvitePassword] = useState('');

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast({
          title: 'App instalado!',
          description: 'O atalho foi adicionado à sua área de trabalho.',
        });
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
    navigate('/');
  };

  const handleSkipInstall = () => {
    setShowInstallPrompt(false);
    navigate('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error, data } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      setIsLoading(false);
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos.' 
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    // After successful login, check for pending invitations and process them
    const inviteId = searchParams.get('invite');
    if (inviteId && data?.user) {
      try {
        const { data: accepted, error: acceptError } = await supabase
          .rpc('accept_invitation', { 
            _invitation_id: inviteId, 
            _user_id: data.user.id 
          });
        
        if (accepted && !acceptError) {
          toast({
            title: 'Bem-vindo!',
            description: 'Login realizado e permissões do convite aplicadas.',
          });
        } else {
          toast({
            title: 'Bem-vindo!',
            description: 'Login realizado com sucesso.',
          });
        }
      } catch (err) {
        console.error('Error processing invitation after login:', err);
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso.',
        });
      }
    } else {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });
    }
    
    setIsLoading(false);
    // Navigation will happen via useEffect after user state updates
    // This allows us to show install prompt if available
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupPassword || !signupName) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    // Validate invite token if using invitation
    if (invitation) {
      if (!invitePassword) {
        toast({
          title: 'Erro',
          description: 'Por favor, informe o código do convite.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate token using secure RPC function - normalize to uppercase
      const { data: validationData, error: validationError } = await supabase
        .rpc('validate_invitation_token', { 
          _invitation_id: invitation.id, 
          _token: invitePassword.toUpperCase().trim()
        });
      
      if (validationError || !validationData?.[0]?.is_valid) {
        toast({
          title: 'Código do convite inválido',
          description: 'Verifique o código enviado junto com o convite.',
          variant: 'destructive',
        });
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      });
      return;
    }

    if (signupPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Erro ao cadastrar',
          description: 'Este email já está cadastrado.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao cadastrar',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Verifique seu email para confirmar o cadastro.',
      });
    }
  };

  // Show install prompt after successful login
  if (showInstallPrompt && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Login realizado com sucesso!</CardTitle>
            <CardDescription>
              Deseja criar um atalho na área de trabalho para acessar o TAI Finance rapidamente?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleInstallApp} className="w-full" size="lg">
              <Download className="mr-2 h-5 w-5" />
              Criar atalho na área de trabalho
            </Button>
            <Button variant="outline" onClick={handleSkipInstall} className="w-full">
              Não, obrigado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2 bg-primary rounded-lg">
              <DollarSign className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">TAI Finance</CardTitle>
          </div>
          <CardDescription>
            Sistema de Gestão Financeira
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2">Verificando convite...</span>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>
              
              {invitation && (
                <div className="mt-4 p-3 bg-primary/10 rounded-md text-sm">
                  <p className="font-medium">Você foi convidado!</p>
                  <p className="text-muted-foreground">Complete seu cadastro para acessar a empresa.</p>
                </div>
              )}
              
              {invitationStatus?.user_exists && (
                <div className="mt-4 p-3 bg-primary/10 rounded-md text-sm">
                  <p className="font-medium text-primary">Sua conta já está ativa!</p>
                  <p className="text-muted-foreground">Use seu email e senha para entrar.</p>
                </div>
              )}
              
              <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading || !!invitation}
                    className={invitation ? 'bg-muted' : ''}
                  />
                  {invitation && (
                    <p className="text-xs text-muted-foreground">Email vinculado ao convite</p>
                  )}
                </div>
                {invitation && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-password">Código do Convite</Label>
                    <Input
                      id="invite-password"
                      type="text"
                      placeholder="Digite o código do convite"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      disabled={isLoading}
                      className="font-mono tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground">Código fornecido junto com o link do convite</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar'
                  )}
                </Button>
              </form>
            </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
