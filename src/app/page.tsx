'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionCreateRequest } from '@/types';

export default function Home() {
  const [sessionName, setSessionName] = useState('');
  const [totalLaps, setTotalLaps] = useState<number>(5);
  const [participantNames, setParticipantNames] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const addParticipant = () => {
    setParticipantNames([...participantNames, '']);
  };

  const updateParticipantName = (index: number, name: string) => {
    const updated = [...participantNames];
    updated[index] = name;
    setParticipantNames(updated);
  };

  const removeParticipant = (index: number) => {
    if (participantNames.length > 1) {
      const updated = participantNames.filter((_, i) => i !== index);
      setParticipantNames(updated);
    }
  };

  const createSession = async () => {
    const filteredNames = participantNames.filter(name => name.trim() !== '');
    
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }
    
    if (filteredNames.length === 0) {
      alert('Please add at least one participant');
      return;
    }

    if (totalLaps < 1) {
      alert('Please enter a valid number of laps');
      return;
    }

    setIsLoading(true);

    try {
      const payload: SessionCreateRequest = {
        name: sessionName.trim(),
        totalLaps,
        participantNames: filteredNames,
      };

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { session } = await response.json();
      router.push(`/session/${session.id}`);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🏃‍♀️ RunVibe</h1>
            <p className="text-gray-600">Track your running laps</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Morning 5K Run"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Laps
              </label>
              <input
                type="number"
                value={totalLaps}
                onChange={(e) => setTotalLaps(parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Participants
              </label>
              <div className="space-y-2">
                {participantNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateParticipantName(index, e.target.value)}
                      placeholder={`Participant ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {participantNames.length > 1 && (
                      <button
                        onClick={() => removeParticipant(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addParticipant}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + Add Participant
              </button>
            </div>

            <button
              onClick={createSession}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? 'Creating Session...' : 'Create Session'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
