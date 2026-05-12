import React from 'react';
import { motion } from 'framer-motion';

const Card = ({
  children,
  className = '',
  hoverable = true,
  onClick,
  gradient = false,
  ...props
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -8, boxShadow: '0 26px 52px rgba(96, 64, 38, 0.18)' } : {}}
      whileTap={hoverable ? { scale: 0.98 } : {}}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
      onClick={onClick}
      {...props}
      className={`
        card bright-grid relative overflow-hidden rounded-[28px] p-6
        transition-all duration-300
        ${hoverable ? 'cursor-pointer' : ''}
        shadow-lg hover:shadow-2xl
        ${className}
      `}
    >
      {gradient && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fff4ea] via-transparent to-[#e8f5f1] opacity-0 transition-opacity duration-300 hover:opacity-100" />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export default Card;
