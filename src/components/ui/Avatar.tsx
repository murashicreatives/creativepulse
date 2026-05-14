import React from 'react';
import { useApp, COLORS } from '../../contexts/AppContext';

interface AvatarProps {
  initials: string;
  size?: 'sm' | 'lg' | 'detail';
}

export default function Avatar({ initials, size = 'sm' }: AvatarProps) {
  const { state } = useApp();
  const person = state?.people.find(x => x.initials === initials);
  const c = person?.color || COLORS[0];
  const s = size === 'lg' ? 'w-10 h-10 text-[13px]' : size === 'detail' ? 'w-[22px] h-[22px] text-[9px]' : 'w-5 h-5 text-[8px]';
  
  return (
    <div 
      className={`${s} rounded-full flex items-center justify-center font-medium shrink-0`}
      style={{ background: c.bg, color: c.txt }}
    >
      {initials}
    </div>
  );
}
