'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Loader } from 'lucide-react';

export function StatusIndicator() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Simulate connection status check
    const timer = setTimeout(() => {
      setIsOnline(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center space-x-2">
      {isOnline ? (
        <CheckCircle className="h-5 w-5 text-primary" />
      ) : (
        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
      )}
      <span className="text-sm font-medium text-muted-foreground">
        {isOnline ? 'Connected' : 'Connecting'}
      </span>
    </div>
  );
}
