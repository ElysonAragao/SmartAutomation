import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

const securityTips = [
  {
    title: 'Use WPA2/WPA3',
    description: 'Always connect your ESP32 to a secure Wi-Fi network.',
  },
  {
    title: 'Implement Authentication',
    description: 'Protect your web interface with a login or API tokens.',
  },
  {
    title: 'Enable HTTPS/TLS',
    description: 'Encrypt all communication between your phone and the ESP32.',
  },
  {
    title: 'Sanitize Inputs',
    description:
      'Validate all data received from the web to prevent crashes or exploits.',
  },
];

export function SecurityInfoCard() {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Security</CardTitle>
        <CardDescription>
          Key practices to keep your device secure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {securityTips.map((tip) => (
            <li key={tip.title} className="flex items-start gap-4">
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{tip.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {tip.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
