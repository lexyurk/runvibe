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

  // Helper function to sync session to server
  const syncToServer = async (sessionData: RunSession) => {
    try {
      const response = await fetch('/api/sessions/sync', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          participants: sessionData.participants,
          status: sessionData.status,
          endTime: sessionData.endTime,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server sync error:', errorData);
        throw new Error('Failed to sync with server');
      }

      console.log('Successfully synced to server');
      return true;
    } catch (error) {
      console.error('Error syncing to server:', error);
      return false;
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
    if (!session) return;

    // Prevent concurrent updates for the same participant
    if (updatingParticipants.has(participantId)) {
      console.log('Participant update already in progress, skipping:', participantId);
      return;
    }

    try {
      // Mark participant as being updated
      setUpdatingParticipants(prev => new Set(prev).add(participantId));
      
      console.log('Updating participant locally:', participantId, 'action:', action);
      
      // 1. UPDATE LOCAL STATE IMMEDIATELY (Optimistic Update)
      const updatedSession = { ...session };
      const participantIndex = updatedSession.participants.findIndex(p => p.id === participantId);
      
      if (participantIndex === -1) {
        console.error('Participant not found:', participantId);
        return;
      }

      const participant = { ...updatedSession.participants[participantIndex] };
      
      if (action === 'addLap') {
        // Add a lap if not already finished and hasn't reached total laps
        if (!participant.finished && participant.lapsCompleted < session.totalLaps) {
          participant.lapsCompleted += 1;
          
          // Mark as finished if reached total laps
          if (participant.lapsCompleted >= session.totalLaps) {
            participant.finished = true;
            participant.finishTime = new Date().toISOString();
          }
        }
      } else if (action === 'finish') {
        participant.finished = true;
        participant.finishTime = new Date().toISOString();
      }

      // Update the participant in the array
      updatedSession.participants[participantIndex] = participant;

      // Check if all participants are finished
      const allFinished = updatedSession.participants.every(p => p.finished);
      if (allFinished && updatedSession.status === 'running') {
        updatedSession.status = 'finished';
        updatedSession.endTime = new Date().toISOString();
      }

      console.log('Local state updated - participant:', participant.name, 'laps:', participant.lapsCompleted, 'finished:', participant.finished);
      
      // 2. UPDATE UI IMMEDIATELY
      setSession(updatedSession);
      
      // 3. SYNC TO SERVER IN BACKGROUND
      const syncSuccess = await syncToServer(updatedSession);
      
      if (!syncSuccess) {
        // Revert to original state on sync error
        setSession(session);
        throw new Error('Failed to sync with server');
      }
      
    } catch (error) {
      console.error('Error updating participant:', error);
      alert('Failed to update participant');
      // Revert to original state on error
      setSession(session);
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
    // TEMPORARILY DISABLED: Remove sorting to fix data corruption issues
    // const sorted = [...participants].sort((a, b) => {
    //   // Sort by laps completed (ascending), then by name
    //   if (a.lapsCompleted === b.lapsCompleted) {
    //     return a.name.localeCompare(b.name);
    //   }
    //   return a.lapsCompleted - b.lapsCompleted;
    // });
    
    console.log('Participants in original order (no sorting):', participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
    
    // Return original order without sorting
    return [...participants];
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

          {/* Final Results Leaderboard */}
          {session.status === 'finished' && (
            <div className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">🏆 Final Leaderboard</h2>
              
              {/* Leaderboard */}
              <div className="space-y-3">
                {sortedParticipants
                  .filter(p => p.finished)
                  .sort((a, b) => {
                    // Sort by laps completed (descending), then by finish time (ascending)
                    if (a.lapsCompleted !== b.lapsCompleted) {
                      return b.lapsCompleted - a.lapsCompleted;
                    }
                    if (a.finishTime && b.finishTime) {
                      return new Date(a.finishTime).getTime() - new Date(b.finishTime).getTime();
                    }
                    return 0;
                  })
                  .map((participant, index) => {
                    const position = index + 1;
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                    const bgColor = position === 1 ? 'bg-yellow-100 border-yellow-300' : 
                                   position === 2 ? 'bg-gray-100 border-gray-300' :
                                   position === 3 ? 'bg-orange-100 border-orange-300' :
                                   'bg-white border-gray-200';
                    
                    const formatFinishTime = (finishTime?: string, startTime?: string) => {
                      if (!finishTime || !startTime) return 'N/A';
                      
                      const start = new Date(startTime).getTime();
                      const finish = new Date(finishTime).getTime();
                      const diff = finish - start;
                      
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                      
                      if (hours > 0) {
                        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      } else {
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      }
                    };

                    return (
                      <div
                        key={participant.id}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 ${bgColor} ${
                          position <= 3 ? 'shadow-md' : 'shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-600 w-8">
                              #{position}
                            </span>
                            {medal && <span className="text-2xl">{medal}</span>}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">{participant.name}</h3>
                            <p className="text-sm text-gray-600">
                              {participant.lapsCompleted} / {session.totalLaps} laps completed
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-mono text-lg font-semibold text-gray-900">
                            {formatFinishTime(participant.finishTime, session.startTime)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Finished at {participant.finishTime ? new Date(participant.finishTime).toLocaleTimeString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Unfinished participants */}
              {sortedParticipants.some(p => !p.finished) && (
                <div className="mt-6 pt-4 border-t border-yellow-200">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">Did Not Finish</h3>
                  <div className="space-y-2">
                    {sortedParticipants
                      .filter(p => !p.finished)
                      .map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-medium">DNF</span>
                            <span className="font-medium text-gray-700">{participant.name}</span>
                          </div>
                          <span className="text-gray-600">
                            {participant.lapsCompleted} / {session.totalLaps} laps
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Race summary */}
              <div className="mt-6 pt-4 border-t border-yellow-200 text-center">
                <p className="text-sm text-gray-600">
                  Race completed at {session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'N/A'}
                </p>
                {session.startTime && session.endTime && (
                  <p className="text-sm text-gray-600 mt-1">
                    Total race duration: {(() => {
                      const start = new Date(session.startTime).getTime();
                      const end = new Date(session.endTime).getTime();
                      const diff = end - start;
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                      
                      if (hours > 0) {
                        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                      } else {
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      }
                    })()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 