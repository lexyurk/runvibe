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

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateParticipantRequest = await request.json();
    const { sessionId, participantId, action } = body;
    
    console.log('Participant PUT: sessionId:', sessionId, 'participantId:', participantId, 'action:', action);

    const session = await fetchSession(sessionId);
    if (!session) {
      console.log('Participant PUT: Session not found');
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    console.log('Participant PUT: Current session status:', session.status);
    console.log('Participant PUT: Current participants:', session.participants.map(p => ({ name: p.name, laps: p.lapsCompleted })));

    // Find and update participant
    const participantIndex = session.participants.findIndex(p => p.id === participantId);
    if (participantIndex === -1) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const participant = session.participants[participantIndex];

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
    
    console.log('Participant PUT: Final session status before save:', session.status);
    console.log('Participant PUT: Updated participant state:', session.participants.find(p => p.id === participantId));

    // Store updated session
    await put(`sessions/${sessionId}.json`, JSON.stringify(session), {
      access: 'public',
      allowOverwrite: true,
    });
    
    console.log('Participant PUT: Session saved successfully');

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 });
  }
} 