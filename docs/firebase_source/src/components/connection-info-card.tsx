import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Wifi, Link as LinkIcon, HardDrive, Cloud } from 'lucide-react';

export function ConnectionInfoCard() {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">Informações de Conexão</CardTitle>
        </div>
        <CardDescription>
          Como conectar, configurar e acessar seu dispositivo ESP32.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Acesso via Internet (Esta Aplicação)
            </h4>
            <p className="text-sm text-muted-foreground">
                Esta interface web controla seu dispositivo de qualquer lugar. Ela não usa o endereço IP local, mas sim um "tópico" MQTT (`esp32/comando/rele`) como um endereço único na internet. É por isso que não há um campo para digitar o IP aqui.
            </p>
        </div>
        <div>
            <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Acesso Direto (Rede Local)
            </h4>
            <p className="text-sm text-muted-foreground">
                Você pode acessar o painel de controle básico do dispositivo em um navegador na mesma rede Wi-Fi.
            </p>
            <a 
                href="http://luminaweb.local" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
                http://luminaweb.local
            </a>
        </div>
        <div>
            <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Configuração de IP Fixo
            </h4>
            <p className="text-sm text-muted-foreground">
                Para definir um IP fixo, acesse a página de configuração do próprio dispositivo (via acesso direto). Vá para a página 'Configurar WiFi/MQTT' para definir um IP estático e outras configurações de rede.
            </p>
             <p className="text-xs text-muted-foreground mt-1">
                (Isso garante que as configurações de rede sejam armazenadas no próprio dispositivo.)
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
