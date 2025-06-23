'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RunSession, Participant } from '@/types';

// Timer component
function Timer({ startTime }: { startTime?: string }) {
  const [elapsed, setElapsed] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div className="text-2xl font-mono font-bold text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
      ⏱️ {elapsed}
    </div>
  );
}

export default function SessionPage() {
  const [session, setSession] = useState<RunSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingParticipants, setUpdatingParticipants] = useState<Set<string>>(new Set());
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  useEffect(() => {
    fetchSession();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Session not found');
      }
      const { session } = await response.json();
      setSession(session);
    } catch (error) {
      console.error('Error fetching session:', error);
      setError('Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = async () => {
    if (!session) return;

    try {
      console.log('Starting session with ID:', sessionId);
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'running',
          startTime: new Date().toISOString(),
        }),
      });

      console.log('Start session response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Start session error response:', errorData);
        throw new Error(`Failed to start session: ${errorData.error || response.statusText}`);
      }

      const { session: updatedSession } = await response.json();
      console.log('Session started successfully, new status:', updatedSession.status);
      setSession(updatedSession);
    } catch (error) {
      console.error('Error starting session:', error);
      alert(`Failed to start session: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateParticipant = async (participantId: string, action: 'addLap' | 'finish') => {
    // Prevent concurrent updates for the same participant
    if (updatingParticipants.has(participantId)) {
      console.log('Participant update already in progress, skipping:', participantId);
      return;
    }

    try {
      // Mark participant as being updated
      setUpdatingParticipants(prev => new Set(prev).add(participantId));
      
      console.log('Updating participant:', participantId, 'action:', action, 'current session status:', session?.status);
      console.log('Current participant state before update:', session?.participants.find((p: Participant) => p.id === participantId));
      
      const response = await fetch('/api/participants', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          participantId,
          action,
        }),
      });

      console.log('Participant update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Participant update error:', errorData);
        throw new Error('Failed to update participant');
      }

      const { session: updatedSession } = await response.json();
      console.log('Participant updated, new session status:', updatedSession.status);
      console.log('Updated session participants:', updatedSession.participants.map((p: Participant) => ({ id: p.id, name: p.name, laps: p.lapsCompleted, finished: p.finished })));
      console.log('Updated participant final state:', updatedSession.participants.find((p: Participant) => p.id === participantId));
      
      // Double-check that the updated session has the right data
      console.log('Session before state update (original):', session?.participants.map((p: Participant) => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
      console.log('Session after server update (new):', updatedSession.participants.map((p: Participant) => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
      
      setSession(updatedSession);
    } catch (error) {
      console.error('Error updating participant:', error);
      alert('Failed to update participant');
    } finally {
      // Always remove participant from updating set
      setUpdatingParticipants(prev => {
        const newSet = new Set(prev);
        newSet.delete(participantId);
        return newSet;
      });
    }
  };

  const getSortedParticipants = (participants: Participant[]): Participant[] => {
    const sorted = [...participants].sort((a, b) => {
      // Sort by laps completed (ascending), then by name
      if (a.lapsCompleted === b.lapsCompleted) {
        return a.name.localeCompare(b.name);
      }
      return a.lapsCompleted - b.lapsCompleted;
    });
    
    console.log('Original participants order:', participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
    console.log('Sorted participants order:', sorted.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
    
    return sorted;
  };

  const copySessionLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Session link copied to clipboard!');
  };

  const goHome = () => {
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Session not found'}</p>
          <button
            onClick={goHome}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const sortedParticipants = getSortedParticipants(session.participants);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
              <p className="text-gray-600">
                {session.totalLaps} laps • {session.participants.length} participants
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copySessionLink}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              >
                Share
              </button>
              <button
                onClick={goHome}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Home
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="mb-6">
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                session.status === 'setup' ? 'bg-yellow-100 text-yellow-800' :
                session.status === 'running' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {session.status === 'setup' ? 'Ready to Start' :
                 session.status === 'running' ? 'In Progress' : 'Finished'}
              </span>
              
              {session.status === 'running' && session.startTime && (
                <Timer startTime={session.startTime} />
              )}
              
              {session.status === 'setup' && (
                <button
                  onClick={startSession}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  🏁 Start Race
                </button>
              )}
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants</h2>
            {sortedParticipants.map((participant, index) => {
              console.log(`Rendering participant ${index + 1}: ${participant.name} (ID: ${participant.id}) with ${participant.lapsCompleted} laps`);
              return (
                <div
                  key={participant.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                    participant.finished
                      ? 'bg-green-50 border-green-200'
                      : session.status === 'running'
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-gray-400 w-8">
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{participant.name}</h3>
                    <p className="text-sm text-gray-600">
                      {participant.lapsCompleted} / {session.totalLaps} laps
                      {participant.finished && ' ✅'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Progress bar */}
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-4">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        participant.finished ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min((participant.lapsCompleted / session.totalLaps) * 100, 100)}%`
                      }}
                    ></div>
                  </div>

                  {session.status === 'running' && !participant.finished && (
                    <button
                      onClick={() => updateParticipant(participant.id, 'addLap')}
                      disabled={updatingParticipants.has(participant.id)}
                      className={`px-4 py-2 rounded-md transition-colors font-medium ${
                        updatingParticipants.has(participant.id)
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {updatingParticipants.has(participant.id) ? 'Updating...' : '+1 Lap'}
                    </button>
                  )}

                  {session.status === 'running' && !participant.finished && (
                    <button
                      onClick={() => updateParticipant(participant.id, 'finish')}
                      disabled={updatingParticipants.has(participant.id)}
                      className={`px-4 py-2 rounded-md transition-colors ${
                        updatingParticipants.has(participant.id)
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {updatingParticipants.has(participant.id) ? 'Updating...' : 'Finish'}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Final Results */}
          {session.status === 'finished' && (
            <div className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🏆 Final Results</h2>
              <div className="space-y-2">
                {sortedParticipants.map((participant, index) => (
                  <div key={participant.id} className="flex justify-between items-center">
                    <span className="font-medium">
                      #{index + 1} {participant.name}
                    </span>
                    <span className="text-gray-600">
                      {participant.lapsCompleted} laps completed
                    </span>
                  </div>
                ))}
              </div>
              {session.endTime && (
                <p className="mt-4 text-sm text-gray-600">
                  Finished at {new Date(session.endTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 