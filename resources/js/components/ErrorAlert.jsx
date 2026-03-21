import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function ErrorAlert({ message, onRetry, onClose }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-red-900">Errore</h3>
            <p className="text-sm text-red-700 mt-1">{message}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              >
                Riprova
              </button>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-red-400 hover:text-red-600">
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
