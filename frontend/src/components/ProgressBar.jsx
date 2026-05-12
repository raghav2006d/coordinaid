import React from 'react';
import { motion } from 'framer-motion';

const ProgressBar = ({ value, max = 100, label, color = 'primary', showPercentage = true }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600',
    secondary: 'from-secondary-500 to-secondary-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-3">
          {label && <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>}
          {showPercentage && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent"
            >
              {Math.round(percentage)}%
            </motion.span>
          )}
        </div>
      )}
      <div className="w-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', type: 'spring' }}
          className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full shadow-lg`}
        >
          <motion.div
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="h-full w-full opacity-50 bg-gradient-to-r from-transparent via-white to-transparent"
          />
        </motion.div>
      </div>
    </div>
  );
};

export default ProgressBar;
