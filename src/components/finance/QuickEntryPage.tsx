import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, ChevronDown, Loader2, Plus, Wallet, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRecentSelections } from '@/hooks/useRecentSelections';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';

interface QuickEntryPageProps {
  companyId: string;
}

export function QuickEntryPage({ companyId }: QuickEntryPageProps) {
  const { toast } = useToast();
  const { recentAccounts, recentCategories, loading: loadingRecent, refetch: refetchRecent } = useRecentSelections(companyId);
  const { accounts, loading: loadingAccounts } = useAccounts(companyId);
  const { categories, loading: loadingCategories } = useTransactionCategories(companyId);
  const { createTransaction } = useTransactions(companyId);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [showMoreAccounts, setShowMoreAccounts] = useState(false);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeAccounts = accounts.filter(a => a.is_active);
  const filteredCategories = categories.filter(c => c.type === (isIncome ? 'income' : 'expense'));
  
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // Reset category when switching between income/expense
  const handleTypeChange = (checked: boolean) => {
    setIsIncome(checked);
    setSelectedCategoryId(null);
  };

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      toast({ title: 'Selecione uma conta', variant: 'destructive' });
      return;
    }
    if (!selectedCategoryId) {
      toast({ title: 'Selecione uma categoria', variant: 'destructive' });
      return;
    }
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await createTransaction({
        account_id: selectedAccountId,
        category_id: selectedCategoryId,
        amount: numAmount,
        type: isIncome ? 'income' : 'expense',
        description: description || (isIncome ? 'Receita rápida' : 'Despesa rápida'),
        date: new Date().toISOString().split('T')[0],
      });

      toast({ title: 'Lançamento registrado com sucesso!' });
      
      // Reset form
      setAmount('');
      setDescription('');
      setSelectedAccountId(null);
      setSelectedCategoryId(null);
      setShowMoreAccounts(false);
      setShowMoreCategories(false);
      
      // Refetch recent selections
      refetchRecent();
    } catch (error) {
      toast({ title: 'Erro ao registrar lançamento', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingRecent || loadingAccounts || loadingCategories;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Lance Rápido</h1>
        <p className="text-muted-foreground">Registre uma transação de forma simples e rápida</p>
      </div>

      {/* Type Toggle */}
      <div className="flex items-center justify-center gap-4 py-2">
        <span className={cn("text-sm font-medium", !isIncome && "text-destructive")}>Despesa</span>
        <Switch 
          checked={isIncome} 
          onCheckedChange={handleTypeChange}
        />
        <span className={cn("text-sm font-medium", isIncome && "text-green-600")}>Receita</span>
      </div>

      {/* Amount Input */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <Label className="text-muted-foreground">Valor</Label>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-muted-foreground">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-4xl font-bold text-center border-0 shadow-none focus-visible:ring-0 max-w-[200px] h-auto py-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description Input */}
      <div>
        <Input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-center"
        />
      </div>

      {/* Recent Accounts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Conta</Label>
          </div>
          {selectedAccount && (
            <span className="text-sm text-muted-foreground">
              Selecionado: <span className="font-medium text-foreground">{selectedAccount.name}</span>
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {recentAccounts.map((account) => (
            <Card
              key={account.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedAccountId === account.id 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => {
                setSelectedAccountId(account.id);
                setShowMoreAccounts(false);
              }}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `hsl(${account.color})` }}
                />
                <span className="text-sm font-medium truncate flex-1">{account.name}</span>
                {selectedAccountId === account.id && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
          
          {/* Show more accounts button/select */}
          {activeAccounts.length > recentAccounts.length && (
            showMoreAccounts ? (
              <div className="col-span-2 sm:col-span-4">
                <Select 
                  value={selectedAccountId || ''} 
                  onValueChange={(value) => {
                    setSelectedAccountId(value);
                    setShowMoreAccounts(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione outra conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `hsl(${account.color})` }}
                          />
                          {account.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Card
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 border-dashed"
                onClick={() => setShowMoreAccounts(true)}
              >
                <CardContent className="p-3 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Mais</span>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>

      {/* Recent Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Categoria</Label>
          </div>
          {selectedCategory && (
            <span className="text-sm text-muted-foreground">
              Selecionado: <span className="font-medium text-foreground">{selectedCategory.name}</span>
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(isIncome ? filteredCategories.slice(0, 4) : recentCategories).map((category) => (
            <Card
              key={category.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedCategoryId === category.id 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => {
                setSelectedCategoryId(category.id);
                setShowMoreCategories(false);
              }}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `hsl(${category.color})` }}
                />
                <span className="text-sm font-medium truncate flex-1">{category.name}</span>
                {selectedCategoryId === category.id && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
          
          {/* Show more categories button/select */}
          {filteredCategories.length > (isIncome ? 4 : recentCategories.length) && (
            showMoreCategories ? (
              <div className="col-span-2 sm:col-span-4">
                <Select 
                  value={selectedCategoryId || ''} 
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    setShowMoreCategories(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione outra categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: `hsl(${category.color})` }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Card
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 border-dashed"
                onClick={() => setShowMoreCategories(true)}
              >
                <CardContent className="p-3 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Mais</span>
                </CardContent>
              </Card>
            )
          )}
          
          {/* Show message if no categories */}
          {filteredCategories.length === 0 && (
            <div className="col-span-2 sm:col-span-4 text-center py-4 text-muted-foreground">
              Nenhuma categoria de {isIncome ? 'receita' : 'despesa'} cadastrada
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-background pt-4 pb-2">
        <Button 
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={submitting || !selectedAccountId || !selectedCategoryId || !amount}
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : null}
          {isIncome ? 'Lançar Receita' : 'Lançar Despesa'}
        </Button>
      </div>
    </div>
  );
}
