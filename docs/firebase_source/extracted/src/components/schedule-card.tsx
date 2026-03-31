'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Plus, Trash2 } from 'lucide-react';
import type { Schedule } from '@/lib/types';
import { AddScheduleSheet } from './add-schedule-sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ScheduleCard({
  schedules,
  onAddSchedule,
  onDeleteSchedule,
  onClearAll,
  nicknames,
}: {
  schedules: Schedule[];
  onAddSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  onDeleteSchedule: (id: string) => void;
  onClearAll: () => void;
  nicknames: string[];
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const formatTarget = useCallback((target: string) => {
    if (target === 'all') {
      return 'Todos os Interruptores';
    }
    if (target.startsWith('interruptor-')) {
      const index = parseInt(target.split('-')[1], 10) - 1;
      const defaultName = `Interruptor ${index + 1}`;
      const nickname = nicknames[index];
      return nickname ? `${nickname} (${defaultName})` : defaultName;
    }
    return target;
  }, [nicknames]);

  const formatDays = (days: string[]) => {
    if (days.length === 7) return 'Todos os dias';
    if (days.length === 2 && days.includes('Sáb') && days.includes('Dom')) return 'Fins de semana';
    if (days.length === 5 && !days.includes('Sáb') && !days.includes('Dom')) return 'Dias de semana';
    return days.join(', ');
  }

  return (
    <>
      <Card className="flex h-full flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Programação</CardTitle>
            <CardDescription>Automatize sua iluminação.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" disabled={schedules.length === 0} aria-label="Limpar todos os agendamentos">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Isso irá apagar permanentemente todos os agendamentos do seu dispositivo.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearAll}>Continuar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AddScheduleSheet
              open={isSheetOpen}
              onOpenChange={setIsSheetOpen}
              onAddSchedule={onAddSchedule}
              nicknames={nicknames}
            >
              <Button size="icon" onClick={() => setIsSheetOpen(true)} aria-label="Adicionar Agendamento">
                <Plus className="h-4 w-4" />
              </Button>
            </AddScheduleSheet>
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          {schedules.length > 0 ? (
            <ul className="space-y-3">
              {schedules.map((schedule) => {
                const actionText = schedule.action === 'on' ? 'Ligar' : 'Desligar';
                const durationText =
                  schedule.action === 'on' && schedule.duration
                    ? ` por ${schedule.duration}s`
                    : '';
                const description = `${actionText}${durationText} · ${formatDays(schedule.days)}`;
                
                return (
                  <li
                    key={schedule.id}
                    className="flex items-center justify-between rounded-lg border p-3 pr-1 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-md ${
                          schedule.action === 'on'
                            ? 'bg-accent/20 text-accent-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{schedule.time} - {formatTarget(schedule.target)}</p>
                        <p className="text-sm text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteSchedule(schedule.id)}
                      aria-label={`Excluir agendamento às ${schedule.time}`}
                    >
                      <Trash2 className="h-5 w-5 text-destructive/70 transition-colors hover:text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 p-8 text-center">
              <h3 className="text-lg font-semibold">Nenhum Agendamento</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Adicione agendamentos para que eles apareçam aqui.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
