import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import { RunSession, Participant } from '@/types';

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

interface SyncRequest {
  sessionId: string;
  participants: Participant[];
  status: 'setup' | 'running' | 'finished';
  endTime?: string;
}

export async function PUT(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();
    const { sessionId, participants, status, endTime } = body;
    
    console.log('Session sync: sessionId:', sessionId, 'status:', status);
    console.log('Session sync: participants:', participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted, finished: p.finished })));

    // Fetch current session to preserve other data
    const currentSession = await fetchSession(sessionId);
    if (!currentSession) {
      console.log('Session sync: Session not found');
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update session with new participant data and status
    const updatedSession: RunSession = {
      ...currentSession,
      participants,
      status,
      endTime: endTime || currentSession.endTime,
    };

    console.log('Session sync: Saving updated session with', participants.length, 'participants');
    console.log('Session sync: Participants being saved:', participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted, finished: p.finished })));

    // Store updated session in Vercel Blob
    const result = await put(`sessions/${sessionId}.json`, JSON.stringify(updatedSession), {
      access: 'public',
      allowOverwrite: true,
    });

    console.log('Session sync: Blob put result:', { url: result.url, downloadUrl: result.downloadUrl });

    // CRITICAL: Verify the data was actually saved by re-fetching it
    console.log('Session sync: Verifying data was saved correctly...');
    
    // Small delay to ensure blob storage propagation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const verificationSession = await fetchSession(sessionId);
    
    if (!verificationSession) {
      console.error('Session sync: FAILED - Could not retrieve saved session');
      return NextResponse.json({ error: 'Failed to verify session save' }, { status: 500 });
    }

    console.log('Session sync: Verification - Retrieved participants:', verificationSession.participants.map(p => ({ id: p.id, name: p.name, laps: p.lapsCompleted, finished: p.finished })));
    
    // Check if the saved data matches what we intended to save
    const participantCountMatch = verificationSession.participants.length === participants.length;
    const statusMatch = verificationSession.status === status;
    
    if (!participantCountMatch) {
      console.error('Session sync: MISMATCH - Participant count:', { expected: participants.length, actual: verificationSession.participants.length });
    }
    
    if (!statusMatch) {
      console.error('Session sync: MISMATCH - Status:', { expected: status, actual: verificationSession.status });
    }

    // Detailed comparison of participant data
    for (let i = 0; i < participants.length; i++) {
      const expected = participants[i];
      const actual = verificationSession.participants.find(p => p.id === expected.id);
      
      if (!actual) {
        console.error(`Session sync: MISSING PARTICIPANT - Expected ${expected.name} (${expected.id}) not found in saved data`);
      } else if (actual.lapsCompleted !== expected.lapsCompleted) {
        console.error(`Session sync: LAP MISMATCH - ${expected.name}: expected ${expected.lapsCompleted}, got ${actual.lapsCompleted}`);
      } else if (actual.finished !== expected.finished) {
        console.error(`Session sync: FINISH MISMATCH - ${expected.name}: expected ${expected.finished}, got ${actual.finished}`);
      }
    }

    if (participantCountMatch && statusMatch) {
      console.log('Session sync: ✅ Data verification PASSED - all data saved correctly');
    } else {
      console.error('Session sync: ❌ Data verification FAILED - data corruption detected');
      return NextResponse.json({ error: 'Data verification failed after save' }, { status: 500 });
    }

    return NextResponse.json({ success: true, session: updatedSession });
  } catch (error) {
    console.error('Error syncing session:', error);
    return NextResponse.json({ 
      error: 'Failed to sync session',
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 