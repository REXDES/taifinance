import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePayablesReceivables } from '@/hooks/usePayablesReceivables';
import { cn } from '@/lib/utils';

interface PayablesReceivablesCalendarPageProps {
  companyId: string;
}

export function PayablesReceivablesCalendarPage({ companyId }: PayablesReceivablesCalendarPageProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { payablesReceivables, loading } = usePayablesReceivables(companyId, {
    startDate,
    endDate,
    status: 'pending'
  });

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getRecordsForDay = (day: Date) => {
    return payablesReceivables.filter(record => 
      isSameDay(new Date(record.due_date), day)
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Get the day of week for the first day (0 = Sunday)
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Calendário Financeiro</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium min-w-[150px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the first day of month */}
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} className="min-h-[120px] bg-muted/30 rounded-lg" />
          ))}

          {/* Days of the month */}
          {days.map(day => {
            const records = getRecordsForDay(day);
            const payables = records.filter(r => r.type === 'payable');
            const receivables = records.filter(r => r.type === 'receivable');
            const totalPayable = payables.reduce((sum, r) => sum + Number(r.amount), 0);
            const totalReceivable = receivables.reduce((sum, r) => sum + Number(r.amount), 0);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] border rounded-lg p-2 hover:bg-muted/50 transition-colors",
                  isSameDay(day, new Date()) && "border-primary bg-primary/5"
                )}
              >
                <div className="text-sm font-medium mb-2">
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {records.slice(0, 3).map(record => (
                    <div
                      key={record.id}
                      className={cn(
                        "text-xs p-1 rounded truncate",
                        record.type === 'payable' 
                          ? 'bg-red-500/10 text-red-600'
                          : 'bg-green-500/10 text-green-600'
                      )}
                      title={`${record.description} - ${formatCurrency(Number(record.amount))}`}
                    >
                      {record.description}
                    </div>
                  ))}
                  {records.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{records.length - 3} mais
                    </div>
                  )}
                  {records.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-border/50 space-y-0.5">
                      {totalPayable > 0 && (
                        <div className="text-xs text-red-600 font-medium">
                          -{formatCurrency(totalPayable)}
                        </div>
                      )}
                      {totalReceivable > 0 && (
                        <div className="text-xs text-green-600 font-medium">
                          +{formatCurrency(totalReceivable)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/20" />
          <span className="text-sm text-muted-foreground">A Pagar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500/20" />
          <span className="text-sm text-muted-foreground">A Receber</span>
        </div>
      </div>
    </div>
  );
}
