import { Lightbulb } from 'lucide-react';
import { StatusIndicator } from './status-indicator';

export function Header() {
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            LuminaWeb Control
          </h1>
        </div>
        <StatusIndicator />
      </div>
    </header>
  );
}
