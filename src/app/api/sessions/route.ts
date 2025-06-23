import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import { RunSession, SessionCreateRequest, Participant } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('Session creation: Starting POST request');
    const body: SessionCreateRequest = await request.json();
    console.log('Session creation: Request body:', { name: body.name, totalLaps: body.totalLaps, participantCount: body.participantNames?.length });
    
    // Validate request
    if (!body.name || !body.totalLaps || !body.participantNames || body.participantNames.length === 0) {
      console.error('Session creation: Invalid request body');
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    
    // Create participants
    const participants: Participant[] = body.participantNames.map(name => ({
      id: uuidv4(),
      name,
      lapsCompleted: 0,
      finished: false,
      finishTime: undefined,
    }));

    // Create session
    const session: RunSession = {
      id: uuidv4(),
      name: body.name,
      totalLaps: body.totalLaps,
      participants,
      status: 'setup',
      createdAt: new Date().toISOString(),
    };

    // Store in Vercel Blob
    console.log('Session creation: Storing session in blob storage');
    const result = await put(`sessions/${session.id}.json`, JSON.stringify(session), {
      access: 'public',
    });
    console.log('Session creation: Successfully stored session:', { sessionId: session.id, url: result.url });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
} 