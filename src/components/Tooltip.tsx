import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white/90 backdrop-blur-md border border-[#E5E5E7] rounded-xl shadow-xl pointer-events-none"
          >
            <div className="text-xs font-semibold text-[#0071E3] uppercase tracking-wider mb-1">Quick Look</div>
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/90" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
