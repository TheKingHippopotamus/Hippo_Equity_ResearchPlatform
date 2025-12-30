import React, { useEffect, useState } from 'react';
import type { QueueStatus } from '../../types/models';
import { apiService } from '../../services/api';
import { translationService } from '../../services/translation';
import type { SupportedLanguage } from '../../types/models';
import './AutopilotQueue.css';

interface AutopilotQueueProps {
  queueId: string;
  language?: SupportedLanguage;
  onCancel?: () => void;
  pollInterval?: number;
}

export const AutopilotQueue: React.FC<AutopilotQueueProps> = ({
  queueId,
  language = 'en',
  onCancel,
  pollInterval = 2000, // 2 seconds
}) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadTranslations = async () => {
      const keys = [
        'ui.queueStatus',
        'ui.progress',
        'ui.currentTask',
        'ui.estimatedCompletion',
        'ui.completed',
        'ui.failed',
        'ui.pending',
        'ui.processing',
        'ui.cancel',
      ];

      const translated = await Promise.all(
        keys.map((key) => translationService.translate(key, language))
      );

      const translationMap: Record<string, string> = {};
      keys.forEach((key, index) => {
        translationMap[key] = translated[index];
      });

      setTranslations(translationMap);
    };
    loadTranslations();
  }, [language]);

  useEffect(() => {
    if (!queueId) return;

    const fetchStatus = async () => {
      try {
        const status = await apiService.getQueueStatus(queueId);
        setQueueStatus(status);
        setError(null);

        // Stop polling if queue is completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          return;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch queue status';
        setError(errorMessage);
      }
    };

    // Initial fetch
    fetchStatus();

    // Poll for updates
    const interval = setInterval(fetchStatus, pollInterval);

    return () => clearInterval(interval);
  }, [queueId, pollInterval]);

  if (error) {
    return (
      <div className="autopilot-queue card">
        <div className="queue-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!queueStatus) {
    return (
      <div className="autopilot-queue card">
        <div className="queue-loading">
          <p>{translations['ui.loading'] || 'Loading queue status...'}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'processing':
        return 'status-processing';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="autopilot-queue card">
      <div className="queue-header">
        <h3 className="queue-title">
          {translations['ui.queueStatus'] || 'Queue Status'}
        </h3>
        <span className={`queue-status-badge ${getStatusColor(queueStatus.status)}`}>
          {translations[`ui.${queueStatus.status}`] || queueStatus.status}
        </span>
      </div>

      <div className="queue-progress">
        <div className="queue-progress-header">
          <span className="queue-progress-label">
            {translations['ui.progress'] || 'Progress'}
          </span>
          <span className="queue-progress-percentage">{queueStatus.progress}%</span>
        </div>
        <div className="queue-progress-bar">
          <div
            className="queue-progress-fill"
            style={{ width: `${queueStatus.progress}%` }}
          />
        </div>
      </div>

      <div className="queue-stats">
        <div className="queue-stat">
          <span className="queue-stat-label">
            {translations['ui.completed'] || 'Completed'}
          </span>
          <span className="queue-stat-value">{queueStatus.completedTasks}</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-label">
            {translations['ui.failed'] || 'Failed'}
          </span>
          <span className="queue-stat-value queue-stat-failed">
            {queueStatus.failedTasks}
          </span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-label">
            {translations['ui.pending'] || 'Pending'}
          </span>
          <span className="queue-stat-value">{queueStatus.pendingTasks}</span>
        </div>
        <div className="queue-stat">
          <span className="queue-stat-label">Total</span>
          <span className="queue-stat-value">{queueStatus.totalTasks}</span>
        </div>
      </div>

      {queueStatus.currentTask && (
        <div className="queue-current-task">
          <h4>{translations['ui.currentTask'] || 'Current Task'}</h4>
          <div className="current-task-info">
            <span className="current-task-symbol">{queueStatus.currentTask.symbol}</span>
            <span className={`current-task-status ${getStatusColor(queueStatus.currentTask.status)}`}>
              {queueStatus.currentTask.status}
            </span>
          </div>
          <div className="current-task-position">
            Position: {queueStatus.currentPosition} of {queueStatus.totalTasks}
          </div>
        </div>
      )}

      {queueStatus.estimatedCompletionTime && (
        <div className="queue-eta">
          <strong>{translations['ui.estimatedCompletion'] || 'Estimated Completion'}:</strong>{' '}
          {formatDate(queueStatus.estimatedCompletionTime)}
        </div>
      )}

      {queueStatus.completedAt && (
        <div className="queue-completed">
          <strong>Completed at:</strong> {formatDate(queueStatus.completedAt)}
        </div>
      )}

      {onCancel && queueStatus.status !== 'completed' && queueStatus.status !== 'failed' && (
        <div className="queue-actions">
          <button
            className="button button-secondary"
            onClick={onCancel}
          >
            {translations['ui.cancel'] || 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AutopilotQueue;

