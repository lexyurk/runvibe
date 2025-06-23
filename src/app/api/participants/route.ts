import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import { RunSession, UpdateParticipantRequest } from '@/types';

// Helper function to fetch session from Vercel Blob
async function fetchSession(sessionId: string): Promise<RunSession | null> {
  try {
    // Use Vercel Blob list API to find the session file
    const { blobs } = await list({
      prefix: `sessions/${sessionId}.json`,
      limit: 1,
    });
    
    if (blobs.length === 0) {
      return null;
    }
    
    // Fetch the session data from the blob URL
    const response = await fetch(blobs[0].url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

async function updateParticipantWithRetry(sessionId: string, participantId: string, action: 'addLap' | 'finish', maxRetries = 3): Promise<RunSession> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Participant PUT: Attempt ${attempt}/${maxRetries} for participant ${participantId}`);
    
    const session = await fetchSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    console.log('Participant PUT: Current session status:', session.status);
    console.log('Participant PUT: Current participants (with IDs):', session.participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
    console.log('Participant PUT: Participants array length:', session.participants.length);

    // Find and update participant
    const participantIndex = session.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) {
      throw new Error('Participant not found');
    }

    const participant = session.participants[participantIndex];
    const originalLaps = participant.lapsCompleted;

    if (action === 'addLap') {
      // Add a lap if not already finished and hasn't reached total laps
      if (!participant.finished && participant.lapsCompleted < session.totalLaps) {
        participant.lapsCompleted += 1;
        
        // Mark as finished if reached total laps
        if (participant.lapsCompleted >= session.totalLaps) {
          participant.finished = true;
        }
      }
    } else if (action === 'finish') {
      participant.finished = true;
    }

    // Check if all participants are finished
    const allFinished = session.participants.every(p => p.finished);
    if (allFinished && session.status === 'running') {
      console.log('Participant PUT: All participants finished, setting session to finished');
      session.status = 'finished';
      session.endTime = new Date().toISOString();
    }
    
    console.log(`Participant PUT: Attempt ${attempt} - Updated participant laps from ${originalLaps} to ${participant.lapsCompleted}`);
    console.log('Participant PUT: Final session status before save:', session.status);
    console.log('Participant PUT: Final session participants before save:', session.participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));

    try {
      // Store updated session
      const jsonToSave = JSON.stringify(session);
      console.log('Participant PUT: JSON being saved length:', jsonToSave.length);
      
      await put(`sessions/${sessionId}.json`, jsonToSave, {
        access: 'public',
        allowOverwrite: true,
      });
      
      console.log(`Participant PUT: Attempt ${attempt} - Session saved successfully`);
      
      // Verify the data after save by re-fetching
      const verifySession = await fetchSession(sessionId);
      if (verifySession) {
        console.log('Participant PUT: Verification - Re-fetched session participants:', verifySession.participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted })));
        if (verifySession.participants.length !== session.participants.length) {
          console.error('Participant PUT: WARNING - Participant count mismatch after save!');
        }
      }
      
      return session;
    } catch (error) {
      console.error(`Participant PUT: Attempt ${attempt} failed to save:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
  
  throw new Error('Max retries exceeded');
}

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateParticipantRequest = await request.json();
    const { sessionId, participantId, action } = body;
    
    console.log('Participant PUT: sessionId:', sessionId, 'participantId:', participantId, 'action:', action);

    const session = await updateParticipantWithRetry(sessionId, participantId, action);
    
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
} 