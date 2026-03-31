'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function DeviceControlCard({
  relayStates,
  setRelayStates,
  relayCount,
  nicknames,
  onNicknameChange,
  onCommand,
}: {
  relayStates: boolean[];
  setRelayStates: (
    states: boolean[] | ((prevState: boolean[]) => boolean[])
  ) => void;
  relayCount: number;
  nicknames: string[];
  onNicknameChange: (index: number, name: string) => void;
  onCommand: (command: object) => void;
}) {
  const [durations, setDurations] = useState<string[]>(
    Array(relayCount).fill('')
  );
  const { toast } = useToast();

  const handleRelayChange = (index: number, checked: boolean) => {
    const duration = parseInt(durations[index], 10);
    const command: { rele: number; state: boolean; tempo?: number } = {
      rele: index + 1,
      state: checked,
    };

    if (checked && duration > 0) {
      command.tempo = duration;
    }

    if (!checked) {
        delete command.tempo;
    }

    onCommand(command);

    // Optimistic UI update
    const newStates = [...relayStates];
    newStates[index] = checked;
    setRelayStates(newStates);

    if (checked && duration > 0) {
      toast({
        title: 'Ação Temporizada',
        description: `${nicknames[index] || `Interruptor ${index + 1}`} será ligado por ${duration} segundos.`,
      });
      
      const newDurations = [...durations];
      newDurations[index] = '';
      setDurations(newDurations);

      setTimeout(() => {
        setRelayStates((prevStates) => {
          const statesAfterTimeout = [...prevStates];
          if (statesAfterTimeout[index]) {
              statesAfterTimeout[index] = false;
          }
          return statesAfterTimeout;
        });
      }, duration * 1000);
    }
  };

  const handleAllOnChange = () => {
    onCommand({ all: true });
    setRelayStates(Array(relayCount).fill(true));
    toast({
      title: 'Sucesso',
      description: 'Todos os interruptores foram ligados.',
    });
  };

  const handleAllOffChange = () => {
    onCommand({ all: false });
    setRelayStates(Array(relayCount).fill(false));
    toast({
      title: 'Sucesso',
      description: 'Todos os interruptores foram desligados.',
    });
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          Controle de Iluminação
        </CardTitle>
        <CardDescription>
          Gerencie seus interruptores com um visual claro e status imediato.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {Array.from({ length: relayCount }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'flex flex-col items-center space-y-2 rounded-lg border p-3 text-center transition-colors',
                relayStates[index]
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/5 border-red-500/10'
              )}
            >
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground">{`Interruptor ${index + 1}`}</p>
                <Input
                  value={nicknames[index] ?? ''}
                  onChange={(e) => onNicknameChange(index, e.target.value)}
                  placeholder="..."
                  aria-label={`Apelido para Interruptor ${index + 1}`}
                  className="h-auto w-full border-none bg-transparent p-0 text-center text-sm font-medium focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <Switch
                id={`relay-switch-${index}`}
                checked={relayStates[index]}
                onCheckedChange={(checked) =>
                  handleRelayChange(index, checked)
                }
                aria-label={`Alternar ${nicknames[index] || `Interruptor ${index + 1}`}`}
              />
              <div className="flex w-full max-w-[100px] items-center gap-1 pt-1">
                <Input
                  type="number"
                  placeholder="Tempo"
                  className="h-8 flex-1 text-center text-xs"
                  value={durations[index]}
                  onChange={(e) => {
                    const newDurations = [...durations];
                    newDurations[index] = e.target.value;
                    setDurations(newDurations);
                  }}
                  aria-label={`Duração para o interruptor ${index + 1}`}
                />
                <span className="text-xs text-muted-foreground">s</span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-6 h-px w-full bg-border" />
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleAllOnChange} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
              <Lightbulb className="mr-2 h-4 w-4" /> Ligar Geral
            </Button>
            <Button
              onClick={handleAllOffChange}
              variant="destructive"
              className="flex-1"
            >
              <Lightbulb className="mr-2 h-4 w-4" /> Desligar Geral
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Use estes botões para controlar todos os interruptores
            simultaneamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
