export type Schedule = {
  id: string;
  target: string;
  time: string;
  action: 'on' | 'off';
  days: string[];
  duration?: number;
};
