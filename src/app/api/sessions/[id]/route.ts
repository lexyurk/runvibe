import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import { RunSession } from '@/types';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await fetchSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('PUT: Updating session with ID:', id);
    
    const session = await fetchSession(id);
    if (!session) {
      console.log('PUT: Session not found for ID:', id);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const updates = await request.json();
    console.log('PUT: Updates to apply:', updates);
    
    const updatedSession = { ...session, ...updates };
    console.log('PUT: Updated session status:', updatedSession.status);

    // Store updated session in Vercel Blob with overwrite
    const result = await put(`sessions/${id}.json`, JSON.stringify(updatedSession), {
      access: 'public',
    });
    
    console.log('PUT: Blob update successful, URL:', result.url);
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating session - Full error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({ 
      error: 'Failed to update session', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 