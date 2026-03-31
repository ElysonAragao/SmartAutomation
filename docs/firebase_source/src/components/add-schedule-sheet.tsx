'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Schedule } from '@/lib/types';
import { Checkbox } from './ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const daysOfWeek = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const scheduleSchema = z.object({
  target: z.string({ required_error: 'Você deve selecionar um alvo.' }).min(1, { message: 'Você deve selecionar um alvo.' }),
  time: z
    .string()
    .regex(
      /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      'Formato de hora inválido (HH:MM)'
    ),
  action: z.enum(['on', 'off']),
  days: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'Você deve selecionar pelo menos um dia.',
  }),
  duration: z.string().optional(),
});

type AddScheduleSheetProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSchedule: (schedule: Omit<Schedule, 'id'>) => void;
  nicknames: string[];
};

export function AddScheduleSheet({
  children,
  open,
  onOpenChange,
  onAddSchedule,
  nicknames,
}: AddScheduleSheetProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      target: '',
      time: '12:00',
      action: 'on',
      days: [],
      duration: '',
    },
  });

  const watchedAction = form.watch('action');

  function onSubmit(values: z.infer<typeof scheduleSchema>) {
    
    const targetName = (() => {
      if (values.target === 'all') {
        return 'Todos os Interruptores';
      }
      const index = parseInt(values.target.split('-')[1], 10) - 1;
      const defaultName = `Interruptor ${index + 1}`;
      const nickname = nicknames[index];
      return nickname ? `${nickname} (${defaultName})` : defaultName;
    })();
    
    const scheduleData: Omit<Schedule, 'id'> = {
      target: values.target,
      time: values.time,
      action: values.action,
      days: values.days,
    };

    if (values.duration && parseInt(values.duration, 10) > 0) {
      scheduleData.duration = parseInt(values.duration, 10);
    }

    onAddSchedule(scheduleData);
    onOpenChange(false);
    form.reset();

    let description = `Agendamento para ${targetName} às ${values.time} foi salvo.`;
     if (scheduleData.action === 'on' && scheduleData.duration) {
      description = `${targetName} será ligado às ${values.time} por ${scheduleData.duration} segundos.`;
    }

    toast({
      title: 'Agendamento Adicionado',
      description: description,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Adicionar Agendamento</SheetTitle>
          <SheetDescription>
            Escolha o alvo, a hora, a ação e os dias para automatizar um evento.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <Form {...form}>
            <form
              id="add-schedule-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 py-4"
            >
              <FormField
                control={form.control}
                name="target"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alvo do Agendamento</FormLabel>
                    <FormDescription>
                      Escolha qual interruptor ou grupo será controlado.
                    </FormDescription>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4 pt-2"
                    >
                      {Array.from({ length: 8 }, (_, i) => {
                        const nickname = nicknames[i];
                        const defaultName = `Interruptor ${i + 1}`;
                        const displayName = nickname ? `${nickname} (${defaultName})` : defaultName;
                        const id = `interruptor-${i + 1}`;
                        return (
                          <FormItem key={id} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={id} id={id} />
                            </FormControl>
                            <FormLabel htmlFor={id} className="font-normal w-full">
                              {displayName}
                            </FormLabel>
                          </FormItem>
                        );
                      })}
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="all" id="all-interruptores" />
                        </FormControl>
                        <FormLabel htmlFor="all-interruptores" className="font-normal w-full">
                          Todos os Interruptores
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Ação</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="on" id="r1" />
                          </FormControl>
                          <FormLabel htmlFor="r1" className="font-normal">Ligar</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="off" id="r2"/>
                          </FormControl>
                          <FormLabel htmlFor="r2" className="font-normal">Desligar</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedAction === 'on' && (
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (segundos)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Opcional" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormDescription>
                        Deixe em branco para manter o interruptor ligado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="days"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel>Dias da semana</FormLabel>
                      <FormDescription>
                        Selecione os dias em que este agendamento deve ser executado.
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {daysOfWeek.map((day) => (
                        <FormField
                          key={day}
                          control={form.control}
                          name="days"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day}
                                className="flex flex-row items-center space-x-2 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([
                                            ...field.value,
                                            day,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {day}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancelar</Button>
          </SheetClose>
          <Button type="submit" form="add-schedule-form">Salvar Agendamento</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
