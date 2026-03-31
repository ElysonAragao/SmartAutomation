'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Cpu, Thermometer } from 'lucide-react';

type DeviceSelectorProps = {
  inputValue: string;
  onInputChange: (value: string) => void;
  onConnect: () => void;
  temperature: number | null;
};

export function DeviceSelector({
  inputValue,
  onInputChange,
  onConnect,
  temperature,
}: DeviceSelectorProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          Seletor de Dispositivo
        </CardTitle>
        <CardDescription>
          Digite o código do dispositivo para iniciar a conexão.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="deviceId" className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Código do Dispositivo
          </Label>
          <Input
            type="text"
            id="deviceId"
            placeholder="ex: CX-0001"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onBlur={onConnect}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConnect();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        </div>

        <Separator className="my-6" />

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            Temperatura
          </Label>
          <div className="flex h-10 items-center">
            <p className="text-2xl font-bold">
              {temperature !== null ? (
                <>{temperature.toFixed(1)} &deg;C</>
              ) : (
                <span className="text-base font-normal text-muted-foreground">
                  Aguardando...
                </span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
