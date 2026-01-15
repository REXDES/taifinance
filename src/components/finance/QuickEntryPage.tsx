import { useState, useMemo } from 'react';
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
import { Check, Loader2, Plus, Wallet, Tags, Sparkles } from 'lucide-react';
import { AiCategoryHelper } from './AiCategoryHelper';
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
  const { recentAccounts, recentSubcategories, loading: loadingRecent, refetch: refetchRecent } = useRecentSelections(companyId);
  const { accounts, loading: loadingAccounts } = useAccounts(companyId);
  const { categories, loading: loadingCategories } = useTransactionCategories(companyId);
  const { createTransaction } = useTransactions(companyId);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [showMoreAccounts, setShowMoreAccounts] = useState(false);
  const [showMoreSubcategories, setShowMoreSubcategories] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeAccounts = accounts.filter(a => a.is_active);
  const filteredCategories = categories.filter(c => c.type === (isIncome ? 'income' : 'expense') || c.type === 'both');
  
  // Build flat list of all subcategories with parent info
  const allSubcategories = useMemo(() => {
    return filteredCategories.flatMap(cat => 
      (cat.subcategories || []).map(sub => ({
        id: sub.id,
        name: sub.name,
        category_id: cat.id,
        category_name: cat.name,
        category_color: cat.color,
      }))
    );
  }, [filteredCategories]);

  // For expenses: show recent subcategories if available, otherwise show first 4 from all
  // For income: always show first 4 from all (since recentSubcategories only tracks expenses)
  const displayedSubcategories = isIncome 
    ? allSubcategories.slice(0, 4) 
    : (recentSubcategories.length > 0 ? recentSubcategories : allSubcategories.slice(0, 4));
  
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const selectedSubcategory = allSubcategories.find(s => s.id === selectedSubcategoryId) || 
    recentSubcategories.find(s => s.id === selectedSubcategoryId);

  // Reset subcategory when switching between income/expense
  const handleTypeChange = (checked: boolean) => {
    setIsIncome(checked);
    setSelectedSubcategoryId(null);
  };

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      toast({ title: 'Selecione uma conta', variant: 'destructive' });
      return;
    }
    if (!selectedSubcategoryId) {
      toast({ title: 'Selecione uma subcategoria', variant: 'destructive' });
      return;
    }
    // Remove dots (thousands separator) and replace comma with dot for parsing
    const cleanAmount = amount.replace(/\./g, '').replace(',', '.');
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'destructive' });
      return;
    }

    // Find the category_id from the subcategory
    const subcatInfo = allSubcategories.find(s => s.id === selectedSubcategoryId) || 
      recentSubcategories.find(s => s.id === selectedSubcategoryId);

    setSubmitting(true);
    try {
      await createTransaction({
        account_id: selectedAccountId,
        category_id: subcatInfo?.category_id,
        subcategory_id: selectedSubcategoryId,
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
      setSelectedSubcategoryId(null);
      setShowMoreAccounts(false);
      setShowMoreSubcategories(false);
      
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
        <CardContent className="py-4">
          <div className="text-center space-y-2">
            <Label className="text-muted-foreground flex items-center justify-center gap-2">
              Valor <span className="text-xl font-bold">R$</span>
            </Label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => {
                // Get only digits and comma from input
                let value = e.target.value;
                
                // First, remove all thousand separators (dots used for formatting)
                // and keep only digits and commas
                const digitsAndComma = value.replace(/\./g, '').replace(/[^\d,]/g, '');
                
                // Split by comma to separate integer and decimal parts
                const parts = digitsAndComma.split(',');
                
                // Get integer part (remove leading zeros except for "0")
                let intPart = parts[0].replace(/^0+/, '') || '';
                
                // Get decimal part (limit to 2 digits)
                let decPart = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : '';
                
                // Format integer part with thousand separators (dots)
                if (intPart.length > 3) {
                  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                }
                
                // Combine parts: if user typed comma, always show it
                const hasComma = value.includes(',');
                const formattedValue = hasComma ? intPart + ',' + decPart : intPart;
                
                setAmount(formattedValue);
              }}
              style={{ fontSize: '3.5rem' }}
              className="font-bold text-center bg-transparent border-0 outline-none focus:ring-0 w-full max-w-[320px] text-foreground placeholder:text-muted-foreground/50"
            />
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
                  style={{ backgroundColor: account.color }}
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
                            style={{ backgroundColor: account.color }}
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

      {/* Recent Subcategories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Subcategoria</Label>
            <AiCategoryHelper
              type={isIncome ? 'income' : 'expense'}
              categories={filteredCategories}
              onSelectCategory={(categoryId, subcategoryId) => {
                if (subcategoryId) {
                  setSelectedSubcategoryId(subcategoryId);
                  setShowMoreSubcategories(false);
                } else if (categoryId) {
                  // Category selected but no subcategory - show subcategory selector with toast
                  const category = filteredCategories.find(c => c.id === categoryId);
                  if (category) {
                    toast({
                      title: `Categoria: ${category.name}`,
                      description: 'Selecione uma subcategoria abaixo ou crie uma nova.',
                    });
                  }
                  setShowMoreSubcategories(true);
                }
              }}
              trigger={
                <button
                  type="button"
                  className="text-xs text-primary hover:underline flex items-center gap-1 ml-2"
                >
                  <Sparkles className="w-3 h-3" />
                  Ajude-me
                </button>
              }
            />
          </div>
          {selectedSubcategory && (
            <span className="text-sm text-muted-foreground">
              Selecionado: <span className="font-medium text-foreground">{selectedSubcategory.category_name} → {selectedSubcategory.name}</span>
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {displayedSubcategories.map((subcategory) => (
            <Card
              key={subcategory.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedSubcategoryId === subcategory.id 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-primary/50"
              )}
              onClick={() => {
                setSelectedSubcategoryId(subcategory.id);
                setShowMoreSubcategories(false);
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subcategory.category_color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{subcategory.category_name}</div>
                    <div className="text-sm font-medium truncate">{subcategory.name}</div>
                  </div>
                  {selectedSubcategoryId === subcategory.id && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Show more subcategories button/select */}
          {allSubcategories.length > displayedSubcategories.length && (
            showMoreSubcategories ? (
              <div className="col-span-2 sm:col-span-4">
                <Select 
                  value={selectedSubcategoryId || ''} 
                  onValueChange={(value) => {
                    setSelectedSubcategoryId(value);
                    setShowMoreSubcategories(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione outra subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((category) => (
                      category.subcategories && category.subcategories.length > 0 && (
                        <div key={category.id}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                            {category.name}
                          </div>
                          {category.subcategories.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              <span className="ml-4">{sub.name}</span>
                            </SelectItem>
                          ))}
                        </div>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Card
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 border-dashed"
                onClick={() => setShowMoreSubcategories(true)}
              >
                <CardContent className="p-3 flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Mais</span>
                </CardContent>
              </Card>
            )
          )}
          
          {/* Show message if no subcategories */}
          {allSubcategories.length === 0 && (
            <div className="col-span-2 sm:col-span-4 text-center py-4 text-muted-foreground">
              Nenhuma subcategoria de {isIncome ? 'receita' : 'despesa'} cadastrada
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-0 bg-background pt-4 pb-2">
        <Button 
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={submitting || !selectedAccountId || !selectedSubcategoryId || !amount}
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
