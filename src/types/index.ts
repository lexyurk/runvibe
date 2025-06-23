export interface Participant {
  id: string;
  name: string;
  lapsCompleted: number;
  finished: boolean;
  finishTime?: string;
}

export interface RunSession {
  id: string;
  name: string;
  totalLaps: number;
  participants: Participant[];
  status: 'setup' | 'running' | 'finished';
  startTime?: string;
  endTime?: string;
  createdAt: string;
}

export interface SessionCreateRequest {
  name: string;
  totalLaps: number;
  participantNames: string[];
}

export interface UpdateParticipantRequest {
  sessionId: string;
  participantId: string;
  action: 'addLap' | 'finish';
} 