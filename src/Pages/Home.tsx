import React, { useState } from 'react';
import LogPemadamanListrikNew from '../components/LogPemadamanListrikNew';
import LogMaintenanceAll from '../components/LogMaintenanceAll';

type ActiveTab = 'log-maintenance-all' | 'log-pemadaman-new';

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('log-maintenance-all');

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'log-pemadaman-new':
        return <LogPemadamanListrikNew />;
      case 'log-maintenance-all':
      default:
        return <LogMaintenanceAll />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('log-maintenance-all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === 'log-maintenance-all'
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-300 dark:hover:text-white/90'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-7 4h8M7 8h10M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"
                  />
                </svg>
                <span>Log Maintenance (ALL)</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('log-pemadaman-new')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                activeTab === 'log-pemadaman-new'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-300 dark:hover:text-white/90'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span>Log Pemadaman (NEW)</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Active Component with fade-slide animation */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        <div key={activeTab} className="animate-[fadeSlide_300ms_ease-out]">
          {renderActiveComponent()}
        </div>
      </div>
    </div>
  );
};

export default Home;
