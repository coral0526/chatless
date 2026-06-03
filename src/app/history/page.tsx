'use client';

import React from 'react';
import HistoryToolbar from '@/components/history/HistoryToolbar';
import HistoryList from '@/components/history/HistoryList';

export default function HistoryPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <HistoryToolbar />
      <div className="flex-1 min-h-0">
        <HistoryList />
      </div>
    </div>
  );
} 